import React, { useState } from "react";
import { useAuth } from "../contexts/useAuth";
import { isMaintenanceError } from "../libs/api";
import { Eye, EyeOff } from "lucide-react";
import Dialog from "./Dialog";

const LoginLanding: React.FC = () => {
  const { login } = useAuth();

  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogTitle, setDialogTitle] = useState("Login Failed");
  const [dialogMessage, setDialogMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Frontend validation only
    if (!id.trim() || !password.trim()) {
      setDialogTitle("Validation Error");
      setDialogMessage("User ID and password are required.");
      setIsDialogOpen(true);
      return;
    }

    setLoading(true);

    try {
      await login(id.trim(), password);

      // Success → reset form
      setId("");
      setPassword("");
    } catch (error: any) {
      if (isMaintenanceError(error)) {
        setDialogTitle("Under Maintenance");
        setDialogMessage(error.message);
        setIsDialogOpen(true);
      } else {
        const status = error?.response?.status;
        const backendMessage =
          error?.response?.data?.error || "Unable to sign in. Please try again.";

        // Decide title using HTTP status only
        if (status === 423) {
          setDialogTitle("Account Locked");
        } else if (status === 401) {
          setDialogTitle("Login Failed");
        } else if (status === 400) {
          setDialogTitle("Invalid Request");
        } else {
          setDialogTitle("Login Error");
        }

        // Show EXACT backend message
        setDialogMessage(backendMessage);
        setIsDialogOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div
        className="min-h-screen flex items-center bg-linear-to-br from-indigo-50 via-white to-indigo-100"
        style={{ backgroundImage: "url(/bg0.avif)", backgroundSize: "cover" }}
      >
        <div className="max-w-6xl mx-auto w-full px-4 py-10">
          <div className="max-w-md mx-auto">
            <div className="bg-white/30 backdrop-blur-xl rounded-2xl p-6 shadow-2xl border border-white/40">
              <div className="flex items-center gap-4 mb-6">
                <img src="/VNRVJIET.png" alt="VNR Logo" className="h-16 rounded-xs" />
                <h1 className="text-2xl font-semibold text-gray-800">
                  VNRVJIET Monthly Reports Automation
                </h1>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* EMP ID */}
                <div>
                  <label className="text-sm font-medium text-gray-900">
                    Emp-ID
                  </label>
                  <input
                    type="text"
                    required
                    value={id}
                    onChange={(e) => setId(e.target.value.toUpperCase())}
                    placeholder="Emp ID"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-white/50 bg-white/50"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="text-sm font-medium text-gray-900">
                    Password
                  </label>
                  <div className="relative mt-1">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-3 pr-10 py-2 rounded-lg border border-white/50 bg-white/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-3 flex items-center text-gray-500"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-[#0e6ffd] text-white hover:bg-[#042656] disabled:opacity-60"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Error Dialog */}
      <Dialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        title={dialogTitle}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-base text-gray-700 leading-relaxed">{dialogMessage}</p>
          <div className="flex justify-end pt-4">
            <button
              onClick={() => setIsDialogOpen(false)}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition min-w-30"
            >
              OK
            </button>
          </div>
        </div>
      </Dialog>
    </>
  );
};

export default LoginLanding;