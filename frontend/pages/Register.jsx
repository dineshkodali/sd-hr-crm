/* eslint-disable no-unused-vars */
// src/pages/StaffRooms.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

/**
 * StaffRooms wrapper:
 * - If user has hotel_id, navigate directly to /hotels/:hotelId/rooms
 * - Else call /api/my/rooms to infer hotel_id from staff-assigned rooms (first match)
 * - Else show helpful message
 *
 * This component expects the authenticated user to be available in Navbar / App state
 * and kept in localStorage (as your App does).
 */
export default function StaffRooms() {
  const [status, setStatus] = useState("resolving"); // resolving | redirecting | no-hotel | error
  const [msg, setMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const resolve = async () => {
      try {
        // Try localStorage (App stores user there)
        let user = null;
        try {
          const raw = localStorage.getItem("user");
          if (raw) user = JSON.parse(raw);
        } catch (e) {
          user = null;
        }

        const tryNavigate = (hotelId) => {
          if (!hotelId) return false;
          // go to rooms manager for that hotel
          navigate(`/hotels/${hotelId}/rooms`);
          return true;
        };

        if (user) {
          const id = user.hotel_id || user.hotelId || user.hotel || null;
          if (id && tryNavigate(id)) return setStatus("redirecting");
        }

        // fallback: call backend for staff-specific rooms endpoint (App already uses /api/my/rooms elsewhere)
        try {
          const res = await axios.get("/api/my/rooms");
          const rooms = res?.data?.rooms || [];
          if (rooms.length > 0) {
            const hotelId = rooms[0].hotel_id || rooms[0].hotelId || rooms[0].hotel;
            if (hotelId && tryNavigate(hotelId)) return setStatus("redirecting");
          }
        } catch (err) {
          // ignore - we'll try other fallbacks
        }

        // Another fallback: call /api/hotels and try find a hotel by branch matching user.branch
        if (user && user.branch) {
          try {
            const hres = await axios.get("/api/hotels");
            const hotels = hres?.data?.hotels || [];
            const matched = hotels.find(h => String(h.branch || "") === String(user.branch));
            if (matched && matched.id && tryNavigate(matched.id)) return setStatus("redirecting");
          } catch (err) {
            // ignore
          }
        }

        // nothing found
        if (mounted) {
          setStatus("no-hotel");
          setMsg("You are not assigned to any hotel yet. Contact your manager or admin to be assigned.");
        }
      } catch (err) {
        console.error("StaffRooms resolve error:", err);
        if (mounted) {
          setStatus("error");
          setMsg("Failed to resolve your assigned hotel. Try again or contact admin.");
        }
      }
    };

    resolve();
    return () => { mounted = false; };
  }, [navigate]);

  if (status === "resolving") {
    return <div className="p-6">Resolving your assigned hotel...</div>;
  }
  if (status === "redirecting") {
    return <div className="p-6">Opening your rooms manager…</div>;
  }
  if (status === "no-hotel") {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">No assigned hotel</h2>
        <p className="text-sm text-gray-600 mb-4">{msg}</p>
        <p className="text-sm">You can view hotels from the Hotels page, or ask admin to assign you to a hotel.</p>
      </div>
    );
  }
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold mb-2">Error</h2>
      <p className="text-sm text-red-600">{msg || "Unknown error"}</p>
    </div>
  );
}
