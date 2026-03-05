# Permission System Guide

## Overview
The permission system uses hierarchical permissions where:
- **READ** = View only (no create, edit, delete)
- **CREATE** = View + Create (no edit, delete)
- **UPDATE** = View + Update (no create, delete)
- **DELETE** = View + Delete (no create, edit)

## Usage in Components

### 1. Import the hook
```javascript
import { usePermissions } from "../hooks/usePermissions";
```

### 2. Get user and permissions
```javascript
export default function YourComponent({ user }) {
  const currentUser = user || (() => {
    try {
      const raw = localStorage.getItem("user");
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  })();
  
  const { canRead, canCreate, canUpdate, canDelete } = usePermissions(currentUser);
  const module = "inspections"; // Your module name
  
  const hasRead = canRead(module);
  const hasCreate = canCreate(module);
  const hasUpdate = canUpdate(module);
  const hasDelete = canDelete(module);
}
```

### 3. Conditionally show buttons
```javascript
{hasCreate && (
  <button onClick={handleCreate}>Create New</button>
)}

{hasUpdate && (
  <button onClick={handleEdit}>Edit</button>
)}

{hasDelete && (
  <button onClick={handleDelete}>Delete</button>
)}
```

### 4. Check permissions before actions
```javascript
const handleCreate = async () => {
  if (!hasCreate) {
    alert("You don't have permission to create.");
    return;
  }
  // ... create logic
};

const handleUpdate = async (id) => {
  if (!hasUpdate) {
    alert("You don't have permission to update.");
    return;
  }
  // ... update logic
};

const handleDelete = async (id) => {
  if (!hasDelete) {
    alert("You don't have permission to delete.");
    return;
  }
  // ... delete logic
};
```

## Module Names
Use these module keys when checking permissions:
- `inspections`, `incidents`, `complaints`, `compliance`, `maintenance`
- `aire_tasks`, `litigation`
- `hse_incidents`, `hse_risk_management`, `hse_training`, `hse_audits`
- `safeguarding_referrals`, `safeguarding_risk_assessments`, `vulnerable_users`, `multi_agency`
- `vcs_organisations`, `case_management`, `emergency_protocols`
- `tickets`, `tasks`, `hr_management`, `holidays`, `attendance`, `timesheets`
- `performance`, `training`, `payroll`, `overtime`, `forms`, `reports`
- `dashboard`, `su_data`, `properties`, `employees`





