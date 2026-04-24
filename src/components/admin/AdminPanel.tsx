import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  UserPlus,
  MapPin,
  Save,
  X,
  Shield,
  Mail,
  User as UserIcon,
  Check,
  Plus,
  Edit2,
  Trash2,
  Key,
  AlertCircle,
} from 'lucide-react';
import { User } from '../../types';
import { cn } from '../../lib/utils';

export function AdminPanel({ onDataUpdate }: { onDataUpdate: () => void }) {
  const { token, user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user' as 'admin' | 'user',
    accessibleLocations: [] as string[],
  });
  const [editingUser, setEditingUser] = useState<(User & { password?: string }) | null>(null);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
    fetchData();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.message || 'Failed to fetch users');
      }
    } catch (err) {
      setError('Network error: Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const fetchData = async () => {
    const res = await fetch('/api/data', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const { data } = await res.json();
      const locations = Array.from(new Set(data.map((item: any) => item.location))) as string[];
      setAvailableLocations(locations);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        setIsAddingUser(false);
        setNewUser({ email: '', password: '', name: '', role: 'user', accessibleLocations: [] });
        fetchUsers();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to create user: ${errData.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Network error: Failed to create user');
    }
  };

  const handleUpdateUser = async (id: string, updates: any) => {
    setIsUpdating(true);
    try {
      console.log('Updating user:', id, updates);
      const res = await fetch(`/api/users/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        setEditingUser(null);
        fetchUsers();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to update user: ${errData.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Update user error:', err);
      alert('Network error: Failed to update user');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        fetchUsers();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to delete user: ${errData.message || 'Unknown error'}`);
      }
    } catch (err) {
      alert('Network error: Failed to delete user');
    }
  };

  const toggleLocation = (user: User, location: string) => {
    const currentLocations = user.accessibleLocations || [];
    const locations = currentLocations.includes(location)
      ? currentLocations.filter((l) => l !== location)
      : [...currentLocations, location];

    handleUpdateUser(user.id, { accessibleLocations: locations });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            User Management
          </h2>
          <p className="text-sm sm:text-base text-slate-500 font-medium mt-1">
            Manage access and location permissions
          </p>
        </div>
        <button
          onClick={() => setIsAddingUser(true)}
          className="flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95"
        >
          <UserPlus className="w-5 h-5" />
          Add New User
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1 text-sm font-bold tracking-tight">{error}</div>
          <button
            onClick={fetchUsers}
            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-200"
          >
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border border-slate-100 border-dashed">
          <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin mb-4" />
          <p className="text-slate-400 font-bold text-sm uppercase tracking-widest">
            Loading Users...
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[2.5rem] border border-slate-100 border-dashed text-center px-10">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-6">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">No Users Found</h3>
              <p className="text-slate-500 font-medium max-w-xs mx-auto">
                Click the button above to create the first user account.
              </p>
            </div>
          ) : (
            users.map((user) => (
              <motion.div
                layout
                key={user.id}
                className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden"
              >
                <div className="p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0 ${user.role === 'admin' ? 'bg-amber-500 text-white shadow-amber-100' : 'bg-blue-600 text-white shadow-blue-100'}`}
                    >
                      {user.role === 'admin' ? (
                        <Shield className="w-6 h-6 sm:w-7 sm:h-7" />
                      ) : (
                        <UserIcon className="w-6 h-6 sm:w-7 sm:h-7" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                        {user.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                        <span className="text-xs sm:text-sm font-medium text-slate-500 flex items-center gap-1 truncate">
                          <Mail className="w-3.5 h-3.5" />
                          {user.email}
                        </span>
                        <span
                          className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${user.role === 'admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}
                        >
                          {user.role}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 lg:max-w-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400" />
                      <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">
                        Accessible Locations
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {user.role === 'admin' ? (
                        <span className="text-xs sm:text-sm font-bold text-slate-400 italic">
                          All locations accessible (Admin)
                        </span>
                      ) : (
                        <>
                          {availableLocations.map((loc) => (
                            <button
                              key={loc}
                              onClick={() => toggleLocation(user, loc)}
                              className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all border ${
                                (user.accessibleLocations || []).includes(loc)
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100'
                                  : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-blue-200'
                              }`}
                            >
                              {loc}
                            </button>
                          ))}
                          {availableLocations.length === 0 && (
                            <span className="text-xs sm:text-sm font-medium text-slate-400">
                              No locations available. Upload data first.
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    <button
                      onClick={() => setEditingUser({ ...user, password: undefined })}
                      className="flex-1 lg:flex-none p-3 bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-600 rounded-xl transition-all flex items-center justify-center"
                      title="Edit User"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    {currentUser?.id !== user.id && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="flex-1 lg:flex-none p-3 bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-all flex items-center justify-center"
                        title="Delete User"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingUser(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <form onSubmit={handleAddUser} className="p-6 sm:p-8 md:p-10">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Create New User
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsAddingUser(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                      Full Name
                    </label>
                    <input
                      required
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium"
                      placeholder="John Doe"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium"
                      placeholder="john@company.com"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                      Initial Password
                    </label>
                    <input
                      type="password"
                      required
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium"
                      placeholder="••••••••"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                      User Role
                    </label>
                    <div className="flex gap-4">
                      {['user', 'admin'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setNewUser({ ...newUser, role: r as any })}
                          className={`flex-1 py-3 rounded-2xl font-bold border transition-all ${
                            newUser.role === r
                              ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100'
                              : 'bg-white text-slate-500 border-slate-100 hover:border-blue-200'
                          }`}
                        >
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {newUser.role !== 'admin' && (
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <MapPin className="w-3 h-3" />
                        Accessible Locations
                      </label>
                      {availableLocations.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          {availableLocations.map((loc) => (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => {
                                const locations = newUser.accessibleLocations.includes(loc)
                                  ? newUser.accessibleLocations.filter((l) => l !== loc)
                                  : [...newUser.accessibleLocations, loc];
                                setNewUser({ ...newUser, accessibleLocations: locations });
                              }}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                                newUser.accessibleLocations.includes(loc)
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                  : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                              }`}
                            >
                              <div
                                className={`w-3 h-3 rounded flex items-center justify-center border ${newUser.accessibleLocations.includes(loc) ? 'border-white bg-white/20' : 'border-slate-300'}`}
                              >
                                {newUser.accessibleLocations.includes(loc) && (
                                  <Check className="w-2.5 h-2.5" />
                                )}
                              </div>
                              {loc}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[10px] font-bold text-amber-600 flex items-center gap-2 uppercase tracking-wider">
                          <AlertCircle className="w-4 h-4" />
                          No locations available. Upload data first.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full mt-10 py-4 bg-blue-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all"
                >
                  Create User Account
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
            >
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleUpdateUser(editingUser.id, editingUser);
                }}
                className="p-6 sm:p-8 md:p-10"
              >
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Edit User Account
                  </h3>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                      Full Name
                    </label>
                    <input
                      required
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium"
                      value={editingUser.name}
                      onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium"
                      value={editingUser.email}
                      onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <Key className="w-3 h-3" />
                        Credentials
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          const willUpdate = !editingUser.password;
                          setEditingUser({
                            ...editingUser,
                            password: willUpdate ? ' ' : undefined,
                          });
                        }}
                        className={cn(
                          'text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg transition-all',
                          editingUser.password !== undefined
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-500',
                        )}
                      >
                        {editingUser.password !== undefined
                          ? 'Cancel Password Change'
                          : 'Change Password'}
                      </button>
                    </div>
                    {editingUser.password !== undefined && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-2"
                      >
                        <input
                          type="password"
                          required
                          className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-600 transition-all font-medium"
                          placeholder="Enter new password"
                          value={editingUser.password.trim()}
                          onChange={(e) =>
                            setEditingUser({ ...editingUser, password: e.target.value })
                          }
                        />
                        <p className="text-[10px] font-bold text-slate-400 ml-1 italic">
                          Type at least 6 characters for security.
                        </p>
                      </motion.div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                      User Role
                    </label>
                    <div className="flex gap-4">
                      {['user', 'admin'].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setEditingUser({ ...editingUser, role: r as any })}
                          className={`flex-1 py-3 rounded-2xl font-bold border transition-all ${
                            editingUser.role === r
                              ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-100'
                              : 'bg-white text-slate-500 border-slate-100 hover:border-blue-200'
                          }`}
                        >
                          {r.charAt(0).toUpperCase() + r.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {editingUser.role !== 'admin' && (
                    <div className="space-y-4">
                      <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                        <MapPin className="w-3 h-3" />
                        Accessible Locations
                      </label>
                      {availableLocations.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                          {availableLocations.map((loc) => (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => {
                                const current = editingUser.accessibleLocations || [];
                                const locations = current.includes(loc)
                                  ? current.filter((l) => l !== loc)
                                  : [...current, loc];
                                setEditingUser({ ...editingUser, accessibleLocations: locations });
                              }}
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold border transition-all ${
                                (editingUser.accessibleLocations || []).includes(loc)
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                  : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                              }`}
                            >
                              <div
                                className={`w-3 h-3 rounded flex items-center justify-center border ${(editingUser.accessibleLocations || []).includes(loc) ? 'border-white bg-white/20' : 'border-slate-300'}`}
                              >
                                {(editingUser.accessibleLocations || []).includes(loc) && (
                                  <Check className="w-2.5 h-2.5" />
                                )}
                              </div>
                              {loc}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-[10px] font-bold text-amber-600 flex items-center gap-2 uppercase tracking-wider">
                          <AlertCircle className="w-4 h-4" />
                          No locations available. Upload data first.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isUpdating}
                  className={`w-full mt-10 py-4 text-white rounded-2xl font-black text-lg shadow-xl transition-all flex items-center justify-center gap-2 ${
                    isUpdating
                      ? 'bg-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 shadow-blue-200 hover:bg-blue-700 active:scale-95'
                  }`}
                >
                  {isUpdating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Save Changes
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
