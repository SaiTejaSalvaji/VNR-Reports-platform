import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/useAuth";
import api from "../libs/api";
import { User, Edit, Trash2, Plus, Eye, EyeOff, Shield, Upload, FileSpreadsheet, Download, Search } from "lucide-react";
import Dialog from "../components/Dialog";
import DropdownCombobox from "../components/DropdownCombobox";
import { useNavigate } from "react-router-dom";


interface UserData {
  id: string;
  name: string;
  role: string;
  department_id: number | null;
  department_name?: string;
  created_at: string;
}

interface Department {
  id: number;
  name: string;
}

const Settings: React.FC = () => {
  const { user, updateUser, logout } = useAuth();
  // Admin / General State
  const [users, setUsers] = useState<UserData[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();


  // Dialog states (General & Admin)
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [isEditUserOpen, setIsEditUserOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);

  // Edit profile state
  const [editName, setEditName] = useState("");
  const [editDepartmentId, setEditDepartmentId] = useState<number | null>(null);

  // Change password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Create user state (Admin)
  const [newUserId, setNewUserId] = useState("");
  const [newUserName, setNewUserName] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("faculty");
  const [newUserDepartmentId, setNewUserDepartmentId] = useState<number | null>(null);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);

  // Edit user state (Admin)
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserDepartmentId, setEditUserDepartmentId] = useState<number | null>(null);
  const [editUserPassword, setEditUserPassword] = useState("");
  const [showEditUserPassword, setShowEditUserPassword] = useState(false);

  // Bulk upload state
  const [bulkUploadFile, setBulkUploadFile] = useState<File | null>(null);
  const [bulkUploadResults, setBulkUploadResults] = useState<{ success: number, failed: number, errors: string[] } | null>(null);

  // Department filter state
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');

  // Search state (Admin)
  const [searchQuery, setSearchQuery] = useState("");

  const isAdmin = user?.role === "admin";

  // Helper function to filter users (Admin)
  const filterUsers = (users: UserData[], includeRole?: string) => {
    return users.filter((u) => {
      const baseFilter = u.role !== "admin";
      const roleFilter = !includeRole || u.role === includeRole;
      const deptFilter = departmentFilter === 'all' || u.department_id === Number(departmentFilter);
      const searchFilter = !searchQuery ||
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.id.toLowerCase().includes(searchQuery.toLowerCase());
      return baseFilter && roleFilter && deptFilter && searchFilter;
    });
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchDepartments();
    } else {
      fetchDepartments();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      const response = await api.get("/auth/users");
      const userData = response.data.data || response.data;
      setUsers(userData);
    } catch (error) {
      console.error("Fetch users error:", error);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await api.get("/auth/departments");
      const deptData = response.data.data || response.data;
      setDepartments(deptData);
    } catch (error) {
      console.error("Failed to fetch departments:", error);
    }
  };


  const handleEditProfile = () => {
    setEditName(user?.name || "");
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      await api.patch("/auth/profile", {
        targetUserId: user?.id,
        editData: { name: editName }
      });

      updateUser({ name: editName });
      setMessage("Profile updated successfully!");
      setIsEditProfileOpen(false);
      setTimeout(() => setMessage(""), 3000);
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    // Validate password confirmation
    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setMessage("Password must be at least 6 characters long");
      setLoading(false);
      return;
    }

    try {
      await api.patch("/auth/profile", {
        targetUserId: user?.id,
        editData: { newPassword }
      });

      setMessage("Password changed! Please login again.");
      setNewPassword("");
      setConfirmPassword("");
      setIsChangePasswordOpen(false);
      setTimeout(() => logout(), 2000);
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // For HOD, use their department; for Admin, use selected department
      const deptId = newUserDepartmentId;

      await api.post("/auth/users", {
        id: newUserId.trim(),
        name: newUserName.trim(),
        password: newUserPassword,
        role: newUserRole,
        department_id: deptId,
      });

      setMessage("User created successfully!");
      setIsCreateUserOpen(false);
      setNewUserId("");
      setNewUserName("");
      setNewUserPassword("");
      setNewUserRole("faculty");
      setNewUserDepartmentId(null);
      fetchUsers();
      setTimeout(() => setMessage(""), 3000);
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (u: UserData) => {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserDepartmentId(u.department_id);
    setEditUserPassword("");
    setIsEditUserOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setLoading(true);
    setMessage("");

    try {
      const editData: any = { name: editUserName, department_id: editUserDepartmentId };
      if (editUserPassword.trim()) {
        editData.newPassword = editUserPassword;
      }

      await api.patch("/auth/profile", {
        targetUserId: editingUser.id,
        editData
      });

      setMessage("User updated successfully!");
      setIsEditUserOpen(false);
      fetchUsers();
      setTimeout(() => setMessage(""), 3000);
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Failed to update user");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userRole: string) => {
    if (userRole === "admin" || userId === user?.id) {
      setMessage("Cannot delete admin users or yourself");
      return;
    }

    if (!confirm(`Are you sure you want to delete user: ${userId}?`)) {
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await api.delete(`/auth/users/${encodeURIComponent(userId)}`);
      setMessage("User deleted successfully!");
      fetchUsers();
      setTimeout(() => setMessage(""), 3000);
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Failed to delete user");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkUploadFile) {
      setMessage("Please select a file to upload");
      return;
    }

    setLoading(true);
    setMessage("");
    setBulkUploadResults(null);

    try {
      const formData = new FormData();
      formData.append('file', bulkUploadFile);

      const response = await api.post('/auth/bulk-upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const results = response.data;
      setBulkUploadResults(results);

      if (results.success > 0) {
        setMessage(`Successfully created ${results.success} users. ${results.failed > 0 ? `${results.failed} failed.` : ''}`);
        fetchUsers(); // Refresh the user list
      } else {
        setMessage("No users were created. Please check the file format and data.");
      }

      setBulkUploadFile(null);
      if (results.success > 0 || results.failed === 0) {
        setTimeout(() => setIsBulkUploadOpen(false), 3000);
      }
    } catch (error: any) {
      setMessage(error.response?.data?.error || "Failed to upload file");
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    // Create CSV template content
    const csvContent = `facultyCode,name,role,department
CSE-001,Dr. John Doe,faculty,CSE
ECE-HOD,Dr. Jane Smith,hod,ECE
ME-003,Prof. Mike Johnson,faculty,ME`;

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_upload_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-gray-600">Please log in to view settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success/Error Message */}
      {message && (
        <div
          className={`p-4 rounded-lg ${message.includes("success") || message.includes("successfully")
            ? "bg-green-50 text-green-700 border border-green-200"
            : "bg-red-50 text-red-700 border border-red-200"
            }`}
        >
          {message}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-2xl font-bold border border-gray-200">
              {user.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
            </div>
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
              <div className="flex flex-col gap-1 text-sm text-gray-600">
                <div className="flex gap-2">
                  <span className="font-medium text-gray-500 w-16">EMP ID:</span>
                  <span className="text-gray-900 font-semibold">{user.id}</span>
                </div>
                {user.department_name && (
                  <div className="flex gap-2">
                    <span className="font-medium text-gray-500 w-16">Dept:</span>
                    <span className="text-gray-900">{user.department_name}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <span className="font-medium text-gray-500 w-16">Role:</span>
                  <span className="text-gray-900 capitalize">{user.role}</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={handleEditProfile}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Edit size={16} />
              Edit Profile
            </button>
            <button
              onClick={() => setIsChangePasswordOpen(true)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center justify-center gap-2 text-sm font-medium"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>


      {/* Admin: User Management */}
      {isAdmin && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">User Management</h3>
                <p className="text-sm text-gray-600">Manage system users and permissions</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsBulkUploadOpen(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 text-sm font-medium"
                >
                  <Upload size={16} />
                  Bulk Upload
                </button>
                <button
                  onClick={() => setIsCreateUserOpen(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 text-sm font-medium"
                >
                  <Plus size={16} />
                  Add User
                </button>
              </div>
            </div>
          </div>

          {/* Filters & Stats */}
          <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Filter by Department:</span>
                  <div className="w-64">
                    <DropdownCombobox
                      options={[
                        { value: 'all', label: 'All Departments' },
                        ...departments.map(dept => ({ value: dept.id, label: dept.name }))
                      ]}
                      value={departmentFilter}
                      onChange={(value) => setDepartmentFilter(String(value))}
                      placeholder="Select department"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search by name or EMP ID..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-600">
                  Total: {filterUsers(users).length}
                </span>
                <span className="text-blue-600">
                  HODs: {filterUsers(users, 'hod').length}
                </span>
                <span className="text-green-600">
                  Faculty: {filterUsers(users, 'faculty').length}
                </span>
              </div>
            </div>
          </div>

          {/* User Table */}
          <div className="overflow-x-auto">
            {filterUsers(users).length === 0 ? (
              <div className="text-center py-12">
                <div className="bg-gray-100 p-3 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
                  {searchQuery ? <Search className="h-6 w-6 text-gray-400" /> : <User className="h-6 w-6 text-gray-400" />}
                </div>
                <h4 className="text-base font-medium text-gray-900 mb-1">
                  {searchQuery ? 'No Users Found' : 'No Users Found'}
                </h4>
                <p className="text-sm text-gray-600 mb-4">
                  {searchQuery
                    ? `No users match "${searchQuery}". Try adjusting your search or filters.`
                    : departmentFilter === 'all'
                      ? 'Create your first user account.'
                      : 'No users in selected department.'
                  }
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setIsCreateUserOpen(true)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 mx-auto text-sm"
                  >
                    <Plus size={16} />
                    Add User
                  </button>
                )}
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Department</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filterUsers(users).map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                            {u.name.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">{u.name}</div>
                            <div className="text-xs text-gray-500">EMP ID: {u.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${u.role === 'hod'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                          }`}>
                          {u.role === 'hod' ? 'HOD' : 'Faculty'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{u.department_name || 'No Department'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{new Date(u.created_at).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEditUser(u)}
                            disabled={loading}
                            className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50 p-1 rounded"
                            title="Edit User"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(u.id, u.role)}
                            disabled={loading || u.id === user.id}
                            className="text-red-600 hover:text-red-900 disabled:opacity-50 p-1 rounded"
                            title="Delete User"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Dialog */}
      <Dialog
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
        title="Edit Profile"
        maxWidth="md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>


          {/* Show current department for all users (read-only) */}
          {user?.department_name && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department
              </label>
              <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                {user.department_name}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {user?.role === 'admin' ? 'Department assignments are managed through user management' : 'Contact your administrator to change your department'}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsEditProfileOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog
        isOpen={isChangePasswordOpen}
        onClose={() => {
          setIsChangePasswordOpen(false);
          setNewPassword("");
          setConfirmPassword("");
          setMessage("");
        }}
        title="Change Password"
        maxWidth="md"
      >
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password *
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Enter new password"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm New Password *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Confirm new password"
                minLength={6}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
            )}
          </div>

          <p className="text-sm text-gray-500 italic">
            Note: You will be logged out after changing your password and will need to log in again.
          </p>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => {
                setIsChangePasswordOpen(false);
                setNewPassword("");
                setConfirmPassword("");
                setMessage("");
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? "Changing..." : "Change Password"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Create User Dialog */}
      <Dialog
        isOpen={isCreateUserOpen}
        onClose={() => setIsCreateUserOpen(false)}
        title="Create New User"
        maxWidth="2xl"
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-linear-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-100">
            <h4 className="font-semibold text-indigo-900 mb-1">
              New User Account
            </h4>
            <p className="text-sm text-indigo-700">
              Fill out the form below to create a new user account
            </p>
          </div>

          <form onSubmit={handleCreateUser} className="space-y-6">
            {/* Basic Information */}
            <div>
              <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <User size={16} className="text-indigo-600" />
                Basic Information
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    User ID *
                  </label>
                  <input
                    type="text"
                    value={newUserId}
                    onChange={(e) => setNewUserId(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., DEPT-FAC-001"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will be used for login. Choose a unique identifier.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="e.g., Dr. John Doe"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Role & Department */}
            <div>
              <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Shield size={16} className="text-indigo-600" />
                Role & Department
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Role *
                  </label>
                  <DropdownCombobox
                    options={[
                      { value: 'faculty', label: '👨‍🏫 Faculty' },
                      { value: 'hod', label: '👔 HOD (Head of Department)' }
                    ]}
                    value={newUserRole}
                    onChange={(val) => setNewUserRole(String(val))}
                    placeholder="Select user role"
                    disableSearch={true}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department
                  </label>
                  <DropdownCombobox
                    options={[
                      { value: '', label: '🏢 No Department' },
                      ...departments.map(dept => ({ value: dept.id, label: `🏫 ${dept.name}` }))
                    ]}
                    value={newUserDepartmentId ?? ''}
                    onChange={(val) => setNewUserDepartmentId(val ? Number(val) : null)}
                    placeholder="Select department"
                    disableSearch={true}
                  />
                </div>
              </div>
            </div>

            {/* Security */}
            <div>
              <h5 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Shield size={16} className="text-indigo-600" />
                Security
              </h5>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Password *
                </label>
                <div className="relative">
                  <input
                    type={showNewUserPassword ? "text" : "password"}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Enter secure password (min. 6 characters)"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-700"
                  >
                    {showNewUserPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  User can change this password after first login.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setIsCreateUserOpen(false)}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-linear-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition disabled:opacity-50 font-medium flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus size={18} />
                    Create User
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog
        isOpen={isEditUserOpen}
        onClose={() => setIsEditUserOpen(false)}
        title="Edit User"
        maxWidth="md"
      >
        <form onSubmit={handleSaveUser} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              User ID
            </label>
            <input
              type="text"
              value={editingUser?.id || ''}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50"
              disabled
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={editUserName}
              onChange={(e) => setEditUserName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-700">
              {editUserDepartmentId
                ? departments.find(d => d.id === editUserDepartmentId)?.name || 'Unknown'
                : 'No Department'}
            </div>
            
            {/* DISABLED - Uncomment below to re-enable department editing */}
            {/* <DropdownCombobox
              options={[
                { value: '', label: 'No Department' },
                ...departments.map(dept => ({ value: dept.id, label: dept.name }))
              ]}
              value={editUserDepartmentId ?? ''}
              onChange={(val) => setEditUserDepartmentId(val ? Number(val) : null)}
              placeholder="Select department"
              disableSearch={true}
            /> */}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password (optional)
            </label>
            <div className="relative">
              <input
                type={showEditUserPassword ? "text" : "password"}
                value={editUserPassword}
                onChange={(e) => setEditUserPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Leave blank to keep current"
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowEditUserPassword(!showEditUserPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showEditUserPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={() => setIsEditUserOpen(false)}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Dialog>

      {/* Bulk Upload Dialog */}
      <Dialog
        isOpen={isBulkUploadOpen}
        onClose={() => {
          setIsBulkUploadOpen(false);
          setBulkUploadFile(null);
          setBulkUploadResults(null);
          setMessage("");
        }}
        title="Bulk User Import"
        maxWidth="xl"
      >
        <div className="space-y-5">
          {/* Instructions */}
          <div className="border-l-4 border-blue-500 bg-blue-50 p-4">
            <div className="flex">
              <div className="shrink-0">
                <FileSpreadsheet className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Import multiple users from a CSV or Excel file. Download the template below to ensure proper formatting.
                </p>
              </div>
            </div>
          </div>

          {/* Template & Requirements Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Template Download */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Template File</h4>
                  <p className="text-xs text-gray-600 mt-1">Download the CSV template</p>
                </div>
                <button
                  onClick={downloadTemplate}
                  className="px-3 py-2 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 transition flex items-center gap-1"
                >
                  <Download size={14} />
                  Download
                </button>
              </div>
            </div>

            {/* Requirements */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Required Columns</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <div><span className="font-medium">facultyCode:</span> EMP ID (e.g., CSE-001)</div>
                <div><span className="font-medium">name:</span> Full name</div>
                <div><span className="font-medium">role:</span> "hod" or "faculty"</div>
                <div><span className="font-medium">department:</span> Dept name (e.g., CSE)</div>
              </div>
            </div>
          </div>

          <form onSubmit={handleBulkUpload} className="space-y-5">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload File
              </label>
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${bulkUploadFile
                ? 'border-green-300 bg-green-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
                }`}>
                <div className="space-y-2">
                  {bulkUploadFile ? (
                    <>
                      <FileSpreadsheet size={32} className="mx-auto text-green-600" />
                      <div className="text-sm font-medium text-green-900">{bulkUploadFile.name}</div>
                      <div className="text-xs text-green-700">
                        {(bulkUploadFile.size / 1024).toFixed(1)} KB • Ready to upload
                      </div>
                      <button
                        type="button"
                        onClick={() => setBulkUploadFile(null)}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Choose different file
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload size={32} className="mx-auto text-gray-400" />
                      <div>
                        <label htmlFor="bulk-file-input" className="cursor-pointer">
                          <span className="text-sm font-medium text-gray-900">
                            Click to upload
                          </span>
                          <span className="text-xs text-gray-500 block mt-1">
                            CSV or Excel files (Max 10MB)
                          </span>
                        </label>
                        <input
                          id="bulk-file-input"
                          type="file"
                          accept=".csv,.xlsx,.xls"
                          onChange={(e) => setBulkUploadFile(e.target.files?.[0] || null)}
                          className="sr-only"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Upload Results */}
            {bulkUploadResults && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-900 mb-3">Import Results</h4>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="text-center p-3 bg-white rounded border">
                    <div className="text-lg font-semibold text-green-600">{bulkUploadResults.success}</div>
                    <div className="text-xs text-gray-600">Successfully imported</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded border">
                    <div className="text-lg font-semibold text-red-600">{bulkUploadResults.failed}</div>
                    <div className="text-xs text-gray-600">Failed to import</div>
                  </div>
                </div>
                {bulkUploadResults.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded p-3">
                    <h5 className="text-xs font-medium text-red-900 mb-2">Error Details:</h5>
                    <div className="max-h-24 overflow-y-auto text-xs text-red-800 space-y-1">
                      {bulkUploadResults.errors.map((error, index) => (
                        <div key={index}>• {error}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => {
                  setIsBulkUploadOpen(false);
                  setBulkUploadFile(null);
                  setBulkUploadResults(null);
                  setMessage("");
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !bulkUploadFile}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 text-sm font-medium flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Import Users
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Dialog>


    </div>
  );
};

export default Settings;