// src/pages/Login.jsx
import axios from "axios";
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  User,
  Lock,
  Building2,
  Users,
  FileCheck,
  LifeBuoy,
  Smartphone,
  Key,
  Mail,
  ArrowRight
} from "lucide-react";

// Configure axios with dynamic base URL based on current host
const API_BASE = `${window.location.protocol}//${window.location.host}/api` || "http://localhost:4000/api" || "http://crm.sdgsolutions.in/api";

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

const Login = ({ setUser }) => {
  // ==========================================
  // LOGIC SECTION (UNCHANGED)
  // ==========================================
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [require2FA, setRequire2FA] = useState(false);
  const [hasAuthenticator, setHasAuthenticator] = useState(false);
  const [method2FA, setMethod2FA] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [autoRequestedOtp, setAutoRequestedOtp] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  useEffect(() => {
    if (!require2FA) {
      setAutoRequestedOtp(false);
      return;
    }
    if (method2FA === "otp" && !otpSent && !loading && !autoRequestedOtp) {
      handleRequestOTP();
      setAutoRequestedOtp(true);
    }
  }, [require2FA, method2FA, otpSent, loading, autoRequestedOtp]);

  const handleRequestOTP = async () => {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await api.post("/auth/request-login-otp", { email: form.email });
      setOtpSent(true);
      setSuccess("OTP sent to your email! Check your inbox.");
    } catch (err) {
      const msg = err?.response?.data?.message || "Failed to send OTP";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!form.email.trim() || !form.password) {
      setError("Please enter email and password.");
      return;
    }

    if (require2FA) {
      if (method2FA === "backup" && !backupCode.trim()) {
        setError("Please enter a backup code.");
        return;
      }
      if (method2FA === "authenticator" && totpCode.length !== 6) {
        setError("Please enter a valid 6-digit code.");
        return;
      }
      if (method2FA === "otp" && otpCode.length !== 6) {
        setError("Please enter the OTP from your email.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        email: form.email,
        password: form.password,
      };

      if (require2FA) {
        if (method2FA === "backup") {
          payload.backupCode = backupCode.trim();
        } else if (method2FA === "authenticator") {
          payload.totpCode = totpCode;
        } else if (method2FA === "otp") {
          payload.otpCode = otpCode;
        }
      }

      const res = await api.post("/auth/login", payload);

      if (res.data.require2FA) {
        setRequire2FA(true);
        setHasAuthenticator(res.data.hasAuthenticator);
        setMethod2FA(res.data.hasAuthenticator ? "authenticator" : "otp");
        if (!res.data.hasAuthenticator) {
          setOtpSent(false);
          setOtpCode("");
          setAutoRequestedOtp(false);
        }
        setLoading(false);
        return;
      }

      const user = res?.data?.user ?? res?.data;
      if (!user) {
        setError("Login failed: unexpected server response.");
        setLoading(false);
        return;
      }

      if (res?.data?.token) {
        try {
          localStorage.setItem("authToken", res.data.token);
          axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
        } catch (err) {
          console.error("Failed to store auth token:", err);
        }
      }

      setUser(user);
      try {
        localStorage.setItem("user", JSON.stringify(user));
      } catch (err) {
        // ignore
      }

      navigate("/");

    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Login failed — check credentials or server";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setRequire2FA(false);
    setHasAuthenticator(false);
    setMethod2FA("");
    setTotpCode("");
    setBackupCode("");
    setOtpCode("");
    setOtpSent(false);
    setAutoRequestedOtp(false);
    setError("");
    setSuccess("");
  };

  const [stats, setStats] = useState({ properties: null, serviceUsers: null, compliance: null, safeguarding: null });
  useEffect(() => {
    let mounted = true;
    let timer = null;

    async function fetchStats() {
      try {
        const summaryRes = await api.get('/dashboard/public-summary').catch(() => null);
        const properties = summaryRes && summaryRes.data ? (summaryRes.data.properties ?? null) : null;
        const serviceUsers = summaryRes && summaryRes.data ? (summaryRes.data.serviceUsers ?? null) : null;
        const compliance = summaryRes && summaryRes.data ? (summaryRes.data.compliance ?? null) : null;
        const safeguarding = summaryRes && summaryRes.data ? (summaryRes.data.safeguarding ?? null) : null;

        if (mounted) setStats({ properties, serviceUsers, compliance, safeguarding });
      } catch (err) {
        if (mounted) setStats({ properties: null, serviceUsers: null, compliance: null, safeguarding: null });
      }
    }

    fetchStats();
    timer = setInterval(fetchStats, 10000);

    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState(1);
  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleForgotPasswordClick = (e) => {
    e.preventDefault();
    setForgotPassword(true);
    setError("");
    setSuccess("");
  };

  const handleRequestResetOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      await api.post("/auth/request-reset-otp", { email: resetEmail });
      setSuccess("If an account exists, an OTP has been sent to your email.");
      setResetStep(2);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: resetEmail,
        otpCode: resetOtp,
        newPassword
      });
      setSuccess("Password reset successfully! Please login.");
      setTimeout(() => {
        handleBack();
      }, 2000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4 font-sans text-slate-800">
      <div className="w-full max-w-[1100px] h-[735px] bg-white rounded-[30px] shadow-2xl overflow-hidden flex flex-col lg:flex-row">

        {/* LEFT SIDE: Form Area */}
        <div className="w-full lg:w-[40%] bg-white p-8 lg:p-12 flex flex-col justify-center items-center relative">

          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-[#4CA99D] rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-teal-200">
                <ShieldCheck className="text-white w-8 h-8" strokeWidth={1.5} />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">SD Commercial</h1>
              <p className="text-gray-500 text-sm mt-1">Accommodation Management System</p>
            </div>

            <h2 className="text-xl font-semibold text-center text-gray-800 mb-2">
              {forgotPassword ? "Reset Password" : (require2FA ? "Security Check" : "Welcome back")}
            </h2>
            <p className="text-center text-gray-500 text-sm mb-8">
              {forgotPassword
                ? (resetStep === 1 ? "Enter your email to receive a code" : "Enter the code and new password")
                : (require2FA ? "Verify your identity to continue" : "Sign in to continue to your account")
              }
            </p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm text-center">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-100 text-green-600 text-sm text-center">
                {success}
              </div>
            )}

            {!forgotPassword ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                {!require2FA ? (
                  <>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700 ml-1">Email / Username</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <User className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          name="email"
                          type="email"
                          placeholder="Enter your email"
                          value={form.email}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4CA99D] focus:bg-white transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700 ml-1">Password</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          name="password"
                          type="password"
                          placeholder="Enter your password"
                          value={form.password}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4CA99D] focus:bg-white transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button type="button" onClick={handleForgotPasswordClick} className="text-[#4CA99D] text-sm hover:underline font-medium">
                        Forgot password?
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#9ACCC6] hover:bg-[#88c0b5] text-white font-semibold py-3.5 rounded-xl transition-colors shadow-sm"
                    >
                      {loading ? "Signing In..." : "Sign In"}
                    </button>
                  </>
                ) : (
                  <div className="animate-fade-in">
                    {!method2FA ? (
                      <div className="space-y-3">
                        {hasAuthenticator && (
                          <>
                            <button
                              type="button"
                              onClick={() => setMethod2FA("authenticator")}
                              className="w-full py-3 px-4 bg-gray-50 border border-gray-100 rounded-xl flex items-center gap-3 hover:bg-gray-100 transition-colors"
                            >
                              <Smartphone className="text-[#4CA99D] w-5 h-5" />
                              <span className="text-gray-700 font-medium">Authenticator App</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setMethod2FA("backup")}
                              className="w-full py-3 px-4 bg-gray-50 border border-gray-100 rounded-xl flex items-center gap-3 hover:bg-gray-100 transition-colors"
                            >
                              <Key className="text-gray-500 w-5 h-5" />
                              <span className="text-gray-700 font-medium">Backup Code</span>
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setMethod2FA("otp");
                            setOtpSent(false);
                            setOtpCode("");
                            setAutoRequestedOtp(false);
                            setError("");
                          }}
                          className="w-full py-3 px-4 bg-gray-50 border border-gray-100 rounded-xl flex items-center gap-3 hover:bg-gray-100 transition-colors"
                        >
                          <Mail className="text-blue-500 w-5 h-5" />
                          <span className="text-gray-700 font-medium">Email OTP</span>
                        </button>

                        <button type="button" onClick={handleBack} className="w-full text-center text-gray-500 text-sm mt-4 hover:underline">
                          Back to Login
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-100 text-center">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            {method2FA === "otp" && "Enter Email OTP"}
                            {method2FA === "authenticator" && "Authenticator Code"}
                            {method2FA === "backup" && "Backup Code"}
                          </label>

                          {method2FA === "otp" && !otpSent && (
                            <button
                              type="button"
                              onClick={handleRequestOTP}
                              disabled={loading}
                              className="text-[#4CA99D] underline text-sm mb-2 block w-full text-center"
                            >
                              {loading ? "Sending..." : "Send Code"}
                            </button>
                          )}

                          <input
                            type="text"
                            autoFocus
                            placeholder={method2FA === "backup" ? "XXXXXX" : "000000"}
                            className="w-full text-center text-2xl tracking-widest py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#4CA99D] outline-none"
                            maxLength={method2FA === "backup" ? 10 : 6}
                            value={method2FA === "backup" ? backupCode : method2FA === "authenticator" ? totpCode : otpCode}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (method2FA === "backup") setBackupCode(val.toUpperCase());
                              else if (method2FA === "authenticator") setTotpCode(val.replace(/\D/g, '').slice(0, 6));
                              else setOtpCode(val.replace(/\D/g, '').slice(0, 6));
                            }}
                          />
                        </div>

                        {(method2FA !== "otp" || otpSent) && (
                          <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-[#9ACCC6] hover:bg-[#88c0b5] text-white font-semibold py-3 rounded-xl transition-colors shadow-sm"
                          >
                            {loading ? "Verifying..." : "Verify & Login"}
                          </button>
                        )}

                        <div className="flex justify-between text-sm mt-2">
                          <button type="button" onClick={() => { setMethod2FA(""); setError(""); }} className="text-[#4CA99D]">Change Method</button>
                          <button type="button" onClick={handleBack} className="text-gray-500">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </form>
            ) : (
              <div className="space-y-5 animate-fade-in">
                {resetStep === 1 ? (
                  <form onSubmit={handleRequestResetOtp} className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700 ml-1">Email</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Mail className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="email"
                          placeholder="Your account email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4CA99D] focus:bg-white transition-all"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#9ACCC6] hover:bg-[#88c0b5] text-white font-semibold py-3.5 rounded-xl transition-colors shadow-sm"
                    >
                      {loading ? "Sending..." : "Send Reset Code"}
                    </button>
                    <button type="button" onClick={() => setForgotPassword(false)} className="w-full text-center text-gray-500 text-sm hover:underline">
                      Back to Login
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResetPassword} className="space-y-4">
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700 ml-1">OTP Code</label>
                      <input
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={resetOtp}
                        onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-center text-xl tracking-widest text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4CA99D] focus:bg-white transition-all"
                        required
                        maxLength={6}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700 ml-1">New Password</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="password"
                          placeholder="Min 6 chars"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4CA99D] focus:bg-white transition-all"
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-sm font-medium text-gray-700 ml-1">Confirm Password</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="password"
                          placeholder="Confirm new password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4CA99D] focus:bg-white transition-all"
                          required
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-[#9ACCC6] hover:bg-[#88c0b5] text-white font-semibold py-3.5 rounded-xl transition-colors shadow-sm"
                    >
                      {loading ? "Resetting..." : "Set New Password"}
                    </button>
                    <button type="button" onClick={() => { setResetStep(1); }} className="w-full text-center text-gray-500 text-sm hover:underline">
                      Back to Email
                    </button>
                  </form>
                )}
              </div>
            )}

          </div>
        </div>

        {/* RIGHT SIDE: Info Panel */}
        <div className="hidden lg:flex w-full lg:w-[60%] bg-[#409187] relative flex-col justify-center p-12 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-[#4CA99D] to-[#367c74] opacity-90"></div>
          <div className="relative z-10 max-w-lg mx-auto">
            <h2 className="text-3xl font-bold mb-3 text-center">Streamline Your Operations</h2>
            <p className="text-teal-50 text-center mb-10 text-sm leading-relaxed">
              Comprehensive management platform for housing estate services.
              Securely manage properties, residents, and compliance in one place.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-12">
              <div className="bg-white/10 backdrop-blur-sm p-5 rounded-2xl border border-white/10 hover:bg-white/20 transition-all cursor-default">
                <div className="mb-3 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Property Management</h3>
                <p className="text-xs text-teal-100">Multi-site portfolio tracking</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-5 rounded-2xl border border-white/10 hover:bg-white/20 transition-all cursor-default">
                <div className="mb-3 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Service Users</h3>
                <p className="text-xs text-teal-100">Complete resident profiles</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-5 rounded-2xl border border-white/10 hover:bg-white/20 transition-all cursor-default">
                <div className="mb-3 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <FileCheck className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Compliance</h3>
                <p className="text-xs text-teal-100">Automated tracking & alerts</p>
              </div>

              <div className="bg-white/10 backdrop-blur-sm p-5 rounded-2xl border border-white/10 hover:bg-white/20 transition-all cursor-default">
                <div className="mb-3 w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-sm mb-1">Safeguarding</h3>
                <p className="text-xs text-teal-100">Risk assessment tools</p>
              </div>
            </div>

            <div className="flex justify-between items-center px-4 border-t border-white/20 pt-8">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.properties ?? '—'}</div>
                <div className="text-xs text-teal-100">Properties</div>
              </div>
              <div className="h-8 w-px bg-white/20"></div>
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.serviceUsers ? `${stats.serviceUsers}+` : (stats.serviceUsers === 0 ? '0' : '—')}</div>
                <div className="text-xs text-teal-100">Service Users</div>
              </div>
              <div className="h-8 w-px bg-white/20"></div>
              <div className="text-center flex flex-col items-center">
                <div className="text-lg font-bold flex items-center gap-1">24/7</div>
                <div className="text-xs text-teal-100">Support</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;