/* eslint-disable no-unused-vars */
// src/pages/StaffRooms.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

/**
 * StaffRooms:
 * - first tries to refresh the authenticated user by calling /api/auth/me
 * - if user.hotel_id (or other detected hotel field) exists -> navigate to /hotels/:id/rooms
 * - else fallback to /api/my/rooms or fallback message
 */
export default function StaffRooms() {
  const [status, setStatus] = useState("loading"); // loading | redirecting | no-hotel | error
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const tryNavigate = (hid) => {
      if (!hid) return false;
      navigate(`/hotels/${hid}/rooms`);
      return true;
    };

    const resolve = async () => {
      try {
        // 1) Refresh authenticated user from server (fresh source)
        let serverUser = null;
        try {
          const me = await axios.get("/api/auth/me");
          serverUser = me?.data || null;
          // update client-side copy so UI and other pages get fresh info
          if (serverUser) {
            try {
              localStorage.setItem("user", JSON.stringify(serverUser));
            } catch (e) {
              // ignore localStorage errors
            }
          }
        } catch (err) {
          // If /api/auth/me fails, we continue with local fallback paths
          serverUser = null;
        }

        // 2) Try hotel id from serverUser first (most reliable)
        if (serverUser) {
          const hid = serverUser.hotel_id || serverUser.hotelId || serverUser.hotel || null;
          if (hid && tryNavigate(hid)) {
            if (mounted) setStatus("redirecting");
            return;
          }
        }

        // 3) Fallback: try localStorage user (older behavior)
        let localUser = null;
        try {
          const raw = localStorage.getItem("user");
          if (raw) localUser = JSON.parse(raw);
        } catch (e) {
          localUser = null;
        }
        if (localUser) {
          const hid = localUser.hotel_id || localUser.hotelId || localUser.hotel || null;
          if (hid && tryNavigate(hid)) {
            if (mounted) setStatus("redirecting");
            return;
          }
        }

        // 4) Fallback: call /api/my/rooms to infer hotel from existing rooms
        try {
          const r = await axios.get("/api/my/rooms");
          const rooms = r?.data?.rooms || [];
          if (rooms.length > 0) {
            const hid = rooms[0].hotel_id || rooms[0].hotelId || rooms[0].hotel;
            if (hid && tryNavigate(hid)) {
              if (mounted) setStatus("redirecting");
              return;
            }
          }
        } catch (err) {
          // ignore and move to final fallback
        }

        // 5) nothing found -> show message
        if (mounted) {
          setStatus("no-hotel");
          setMessage("You are not assigned to any hotel yet. Contact admin/manager.");
        }
      } catch (err) {
        console.error("StaffRooms resolve error:", err);
        if (mounted) {
          setStatus("error");
          setMessage("Failed to resolve your assigned hotel. Try refreshing the page.");
        }
      }
    };

    resolve();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (status === "loading") return <div className="p-6">Loading room management…</div>;
  if (status === "redirecting") return <div className="p-6">Opening your rooms manager…</div>;
  if (status === "no-hotel") {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">No Hotel Assigned</h2>
        <p className="text-gray-600">{message}</p>
      </div>
    );
  }
  return (
    <div className="p-6 text-red-600">
      <h2 className="text-xl font-semibold mb-2">Error</h2>
      <p>{message || "Unknown error"}</p>
    </div>
  );
}
