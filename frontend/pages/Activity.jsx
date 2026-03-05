import React from "react";
import ActivityLogs from "../components/ActivityLogs";

export default function Activity() {
 return (
 <div className="p-6">
 {/* <div className="mb-4">
 <h2 className="text-2xl font-bold text-gray-900">Activity</h2>
 <p className="text-sm text-gray-500">All activities performed by you in this website</p>
 </div> */}
 <ActivityLogs />
 </div>
 );
}
