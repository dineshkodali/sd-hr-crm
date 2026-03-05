// Backend/routes/org-chart.js
import express from 'express';
import pool from '../config/db.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// GET /api/org-chart - Get complete organization chart data
router.get('/', protect, async (req, res) => {
  try {
    // Get all branches with manager info
    const branchesQuery = `
      SELECT 
        h.id,
        h.name,
        h.code,
        h.branch,
        h.address,
        h.city,
        h.phone,
        h.manager_id,
        h.status,
        h.property_type,
        u.name as manager_name,
        u.email as manager_email,
        u.phone as manager_phone
      FROM hotels h
      LEFT JOIN users u ON h.manager_id = u.id
      WHERE h.property_type = 'Branch'
      ORDER BY h.name
    `;
    
    const branchesResult = await pool.query(branchesQuery);
    
    // Get all employees grouped by branch
    const employeesQuery = `
      SELECT 
        id,
        name,
        email,
        role,
        branch,
        phone,
        avatar,
        status,
        hotel_id
      FROM users
      WHERE role IN ('admin', 'manager', 'staff')
        AND status = 'active'
      ORDER BY 
        CASE role 
          WHEN 'admin' THEN 1 
          WHEN 'manager' THEN 2 
          WHEN 'staff' THEN 3 
          ELSE 4 
        END,
        name
    `;
    
    const employeesResult = await pool.query(employeesQuery);
    
    // Group employees by branch - try multiple matching strategies
    const employeesByBranch = {};
    employeesResult.rows.forEach(emp => {
      let matched = false;
      
      // Try to match employee to branches
      branchesResult.rows.forEach(branch => {
        // Strategy 1: Match by branch field to code
        if (emp.branch && branch.code && emp.branch.toLowerCase() === branch.code.toLowerCase()) {
          const key = branch.id;
          if (!employeesByBranch[key]) employeesByBranch[key] = [];
          employeesByBranch[key].push(emp);
          matched = true;
        }
        // Strategy 2: Match by branch field to branch field
        else if (emp.branch && branch.branch && emp.branch.toLowerCase() === branch.branch.toLowerCase()) {
          const key = branch.id;
          if (!employeesByBranch[key]) employeesByBranch[key] = [];
          employeesByBranch[key].push(emp);
          matched = true;
        }
        // Strategy 3: Match by hotel_id
        else if (emp.hotel_id && emp.hotel_id === branch.id) {
          const key = branch.id;
          if (!employeesByBranch[key]) employeesByBranch[key] = [];
          employeesByBranch[key].push(emp);
          matched = true;
        }
        // Strategy 4: Match by branch name (partial)
        else if (emp.branch && branch.name && 
                 branch.name.toLowerCase().includes(emp.branch.toLowerCase())) {
          const key = branch.id;
          if (!employeesByBranch[key]) employeesByBranch[key] = [];
          employeesByBranch[key].push(emp);
          matched = true;
        }
      });
      
      // If no match, add to unassigned
      if (!matched) {
        if (!employeesByBranch['unassigned']) employeesByBranch['unassigned'] = [];
        employeesByBranch['unassigned'].push(emp);
      }
    });
    
    // Build organization structure
    const orgChart = branchesResult.rows.map(branch => {
      const employees = employeesByBranch[branch.id] || [];
      
      return {
        id: branch.id,
        name: branch.name,
        code: branch.code,
        branch: branch.branch,
        address: branch.address,
        city: branch.city,
        phone: branch.phone,
        status: branch.status,
        manager: branch.manager_id ? {
          id: branch.manager_id,
          name: branch.manager_name,
          email: branch.manager_email,
          phone: branch.manager_phone
        } : null,
        employeeCount: employees.length,
        employees: employees.map(emp => ({
          id: emp.id,
          name: emp.name,
          email: emp.email,
          role: emp.role,
          phone: emp.phone,
          avatar: emp.avatar,
          status: emp.status,
          branch: emp.branch
        }))
      };
    });
    
    // Get statistics
    const stats = {
      totalBranches: branchesResult.rows.length,
      totalEmployees: employeesResult.rows.length,
      byRole: {
        admin: employeesResult.rows.filter(e => e.role === 'admin').length,
        manager: employeesResult.rows.filter(e => e.role === 'manager').length,
        staff: employeesResult.rows.filter(e => e.role === 'staff').length
      },
      unassigned: employeesByBranch['unassigned']?.length || 0,
      assigned: employeesResult.rows.length - (employeesByBranch['unassigned']?.length || 0)
    };
    
    res.json({
      success: true,
      orgChart,
      stats
    });
    
  } catch (error) {
    console.error('Organization chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch organization chart',
      error: error.message
    });
  }
});

// GET /api/org-chart/branch/:id - Get specific branch with employees
router.get('/branch/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    
    const branchQuery = `
      SELECT 
        h.*,
        u.name as manager_name,
        u.email as manager_email,
        u.phone as manager_phone
      FROM hotels h
      LEFT JOIN users u ON h.manager_id = u.id
      WHERE h.id = $1
    `;
    
    const branchResult = await pool.query(branchQuery, [id]);
    
    if (branchResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Branch not found'
      });
    }
    
    const branch = branchResult.rows[0];
    const branchKey = branch.code || branch.branch || branch.name;
    
    const employeesQuery = `
      SELECT 
        id, name, email, role, branch, phone, avatar, status
      FROM users
      WHERE branch = $1 OR hotel_id = $2
      ORDER BY 
        CASE role 
          WHEN 'admin' THEN 1 
          WHEN 'manager' THEN 2 
          WHEN 'staff' THEN 3 
        END,
        name
    `;
    
    const employeesResult = await pool.query(employeesQuery, [branchKey, id]);
    
    res.json({
      success: true,
      branch: {
        ...branch,
        employees: employeesResult.rows
      }
    });
    
  } catch (error) {
    console.error('Branch detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch branch details',
      error: error.message
    });
  }
});

export default router;
