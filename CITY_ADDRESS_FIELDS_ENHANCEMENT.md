# City and Address Fields Enhancement

## Overview
Successfully added city and address fields to both StaffGrid.jsx and UserManagement.jsx forms to capture more comprehensive employee/user information.

## Changes Made

### 1. StaffGrid.jsx Enhancements

#### AddEmployeeModal
- **Updated formData state** to include `address` and `city` fields
- **Enhanced form reset** to clear address and city fields
- **Updated API payload** to send address and city data to backend
- **Added form fields** for address and city input with proper styling

#### EditEmployeeModal  
- **Updated formData state** to include `address` field (city was already present)
- **Enhanced employee data mapping** to handle `address` field from employee data
- **Updated API payload** to send address data to backend
- **Added address form field** before the existing city field

#### Form Field Details
- **Address Field**: Full-width input for complete address
- **City Field**: Standard input for city name
- **Styling**: Consistent with existing form styling (teal theme, rounded borders)
- **Placement**: Added before password section in AddEmployeeModal, before city in EditEmployeeModal

### 2. UserManagement.jsx Enhancements

#### Form State Management
- **Updated formData state** to include `address` and `city` fields
- **Enhanced handleCreateUser** to reset address and city fields
- **Enhanced handleEditUser** to populate address and city from user data
- **API Integration**: Uses spread operator `{ ...formData }` so automatically includes new fields

#### Form Fields
- **Address Field**: Added in grid layout with proper labeling
- **City Field**: Added in grid layout with proper labeling  
- **Styling**: Consistent with existing UserManagement styling
- **Placement**: Added after branch field but before password section

## Technical Implementation

### StaffGrid.jsx Changes

#### AddEmployeeModal FormData
```javascript
const [formData, setFormData] = useState({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'staff',
  phone: '',
  branch: '',
  address: '',    // NEW
  city: '',       // NEW
  status: 'active'
});
```

#### EditEmployeeModal FormData
```javascript
const [formData, setFormData] = useState({
  name: employee?.name || '',
  email: employee?.email || '',
  phone: employee?.phone || '',
  role: employee?.role || 'staff',
  branch: employee?.branch || employee?.department || '',
  status: employee?.status || 'active',
  address: employee?.address || employee?.addr || '',  // NEW
  city: employee?.city || '',
  country: employee?.country || ''
});
```

#### API Payload Updates
```javascript
const payload = {
  name: formData.name.trim(),
  email: formData.email.trim(),
  // ... other fields
  address: formData.address?.trim() || null,  // NEW
  city: formData.city?.trim() || null,        // NEW
  status: formData.status || 'active'
};
```

### UserManagement.jsx Changes

#### FormData State
```javascript
const [formData, setFormData] = useState({
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'staff',
  phone: '',
  branch: '',
  address: '',    // NEW
  city: '',       // NEW
  status: 'active'
});
```

#### Modal Handlers
```javascript
// Create mode
setFormData({
  // ... existing fields
  address: '',    // NEW
  city: '',       // NEW
  status: 'active'
});

// Edit mode  
setFormData({
  // ... existing fields
  address: user.address || user.addr || '',  // NEW
  city: user.city || '',                      // NEW
  status: user.status || 'active'
});
```

## Form Field Structure

### Address Field
```javascript
<div>
  <label className="block text-sm font-medium text-slate-600 mb-1">
    Address
  </label>
  <input
    name="address"
    value={formData.address}
    onChange={handleChange}
    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
               focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
    placeholder="Full address"
  />
</div>
```

### City Field
```javascript
<div>
  <label className="block text-sm font-medium text-slate-600 mb-1">
    City
  </label>
  <input
    name="city"
    value={formData.city}
    onChange={handleChange}
    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm
               focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200 transition-all"
    placeholder="City"
  />
</div>
```

## Benefits

### Data Collection
- **Complete Address Information**: Captures full address and city separately
- **Better User Profiles**: More comprehensive employee/user information
- **Improved Organization**: Separate fields for better data structure

### User Experience
- **Consistent Styling**: Matches existing form field design
- **Proper Validation**: Fields are optional but properly handled
- **Clear Labeling**: Intuitive field names and placeholders

### Technical Benefits
- **Backend Ready**: API payloads include new fields for backend processing
- **Null Handling**: Proper null/empty value handling for optional fields
- **Data Mapping**: Handles various field name variations (address/addr)

## Files Modified
- `frontend/pages/StaffGrid.jsx` - Added address and city fields to both AddEmployeeModal and EditEmployeeModal
- `frontend/src/pages/UserManagement.jsx` - Added address and city fields to user creation and editing forms

## Testing Recommendations

### StaffGrid.jsx Testing
1. **AddEmployeeModal:**
   - Test creating new employee with address and city
   - Test creating employee without address and city (should handle nulls)
   - Test form reset clears address and city fields
   - Test API payload includes address and city data

2. **EditEmployeeModal:**
   - Test editing employee populates existing address and city
   - Test editing employee with empty address and city
   - Test updating address and city values
   - Test API payload includes updated address and city

### UserManagement.jsx Testing
1. **Create User:**
   - Test creating user with address and city
   - Test creating user without address and city
   - Test form reset clears all fields including address and city

2. **Edit User:**
   - Test editing user populates existing address and city
   - Test editing user with various address field names (address/addr)
   - Test updating address and city values
   - Test API payload includes all form data

### General Testing
- Test form styling consistency across both components
- Test field validation and error handling
- Test responsive design with new fields
- Test accessibility (labels, tab order, screen readers)

The enhancement provides comprehensive address information collection while maintaining consistency with existing form designs and functionality.