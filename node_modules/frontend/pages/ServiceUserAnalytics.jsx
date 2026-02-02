/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { BarChart3, PieChart, Users, Home, TrendingUp, Download, Calendar, Building2, Bed } from 'lucide-react';

axios.defaults.withCredentials = true;

export default function ServiceUserAnalytics() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('demographics');

  // Data states
  const [serviceUsers, setServiceUsers] = useState([]);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);

  // Demographics data
  const [demographics, setDemographics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    movedOut: 0,
    ageGroups: [],
    genderDistribution: [],
    nationalityDistribution: [],
    immigrationStatus: []
  });

  // Accommodation data
  const [accommodation, setAccommodation] = useState({
    totalProperties: 0,
    totalRooms: 0,
    occupiedRooms: 0,
    occupancyRate: 0,
    propertyOccupancy: [],
    roomTypes: []
  });

  const api = useMemo(() => axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    withCredentials: true,
    timeout: 15000
  }), []);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [usersRes, propertiesRes, roomsRes] = await Promise.allSettled([
        api.get('/api/su/users'),
        api.get('/api/properties'),
        api.get('/api/rooms')
      ]);

      const users = usersRes.status === 'fulfilled' ? (usersRes.value.data || []) : [];
      const props = propertiesRes.status === 'fulfilled' ? (propertiesRes.value.data || []) : [];
      const roomsData = roomsRes.status === 'fulfilled' ? (roomsRes.value.data || []) : [];

      setServiceUsers(users);
      setProperties(props);
      setRooms(roomsData);

      // Process demographics
      processDemographics(users);

      // Process accommodation
      processAccommodation(users, props, roomsData);

    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processDemographics = (users) => {
    const totalUsers = users.length;
    const activeUsers = users.filter(u =>
      (u.status || '').toLowerCase() === 'active'
    ).length;
    const movedOut = users.filter(u =>
      (u.status || '').toLowerCase() === 'moved out' ||
      (u.status || '').toLowerCase() === 'movedout'
    ).length;

    // Age groups
    const ageGroups = { '0-17': 0, '18-25': 0, '26-35': 0, '36-50': 0, '51+': 0 };
    users.forEach(user => {
      const dob = user.date_of_birth || user.dob;
      if (dob) {
        const age = calculateAge(dob);
        if (age < 18) ageGroups['0-17']++;
        else if (age <= 25) ageGroups['18-25']++;
        else if (age <= 35) ageGroups['26-35']++;
        else if (age <= 50) ageGroups['36-50']++;
        else ageGroups['51+']++;
      }
    });

    // Gender distribution
    const genderCount = {};
    users.forEach(user => {
      const gender = user.gender || 'Not Specified';
      genderCount[gender] = (genderCount[gender] || 0) + 1;
    });

    // Nationality distribution
    const nationalityCount = {};
    users.forEach(user => {
      const nationality = user.nationality || 'Not Specified';
      nationalityCount[nationality] = (nationalityCount[nationality] || 0) + 1;
    });

    // Immigration status
    const immigrationCount = {};
    users.forEach(user => {
      const status = user.immigration_status || 'Not Specified';
      immigrationCount[status] = (immigrationCount[status] || 0) + 1;
    });

    setDemographics({
      totalUsers,
      activeUsers,
      movedOut,
      ageGroups: Object.entries(ageGroups).map(([name, value]) => ({ name, value })),
      genderDistribution: Object.entries(genderCount).map(([name, value]) => ({ name, value })),
      nationalityDistribution: Object.entries(nationalityCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, value]) => ({ name, value })),
      immigrationStatus: Object.entries(immigrationCount).map(([name, value]) => ({ name, value }))
    });
  };

  const processAccommodation = (users, props, roomsData) => {
    const totalProperties = props.length;
    const totalRooms = roomsData.length;
    const occupiedRooms = roomsData.filter(r =>
      r.status === 'Occupied' || r.service_user_id
    ).length;
    const occupancyRate = totalRooms > 0
      ? Math.round((occupiedRooms / totalRooms) * 100)
      : 0;

    // Property occupancy
    const propertyOccupancy = props.map(prop => {
      const propRooms = roomsData.filter(r =>
        String(r.hotel_id) === String(prop.id) ||
        String(r.property_id) === String(prop.id)
      );
      const propOccupied = propRooms.filter(r =>
        r.status === 'Occupied' || r.service_user_id
      ).length;
      const propTotal = propRooms.length;

      return {
        name: prop.name || prop.hotel_name || `Property ${prop.id}`,
        occupied: propOccupied,
        total: propTotal,
        rate: propTotal > 0 ? Math.round((propOccupied / propTotal) * 100) : 0
      };
    }).filter(p => p.total > 0);

    // Room types (if available in room data)
    const roomTypeCount = {};
    roomsData.forEach(room => {
      const type = room.room_type || room.type || 'Standard';
      roomTypeCount[type] = (roomTypeCount[type] || 0) + 1;
    });

    setAccommodation({
      totalProperties,
      totalRooms,
      occupiedRooms,
      occupancyRate,
      propertyOccupancy,
      roomTypes: Object.entries(roomTypeCount).map(([name, value]) => ({ name, value }))
    });
  };

  const calculateAge = (dob) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const exportToPDF = () => {
    alert('PDF export functionality coming soon');
  };

  const exportToExcel = () => {
    alert('Excel export functionality coming soon');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Service User Analytics</h1>
              <p className="text-gray-600">Comprehensive analytics and reporting for service users</p>
            </div>
            {/* Export Buttons */}
            <div className="flex gap-3">
              <button
                onClick={exportToPDF}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 font-medium"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-5 py-2.5 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 font-medium"
              >
                <Download className="w-4 h-4" />
                Export Excel
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-blue-100 text-blue-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Users className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Service Users</div>
              <div className="text-2xl font-bold text-gray-900">{demographics.totalUsers}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-purple-100 text-purple-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Building2 className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Total Properties</div>
              <div className="text-2xl font-bold text-gray-900">{accommodation.totalProperties}</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-teal-100 text-teal-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <Bed className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Occupancy Rate</div>
              <div className="text-2xl font-bold text-gray-900">{accommodation.occupancyRate}%</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center gap-4 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1">
            <div className="bg-orange-100 text-orange-600 h-14 w-14 rounded-full flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-7 h-7" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-gray-500 text-sm mb-1">Moved Out</div>
              <div className="text-2xl font-bold text-gray-900">{demographics.movedOut}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <div className="mb-6 flex items-center gap-3 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('demographics')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'demographics'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Demographics
              </div>
            </button>
            <button
              onClick={() => setActiveTab('accommodation')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'accommodation'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Accommodation
              </div>
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reports'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4" />
                Reports
              </div>
            </button>
          </div>

          {/* Demographics Tab */}
          {activeTab === 'demographics' && (
            <div className="space-y-6">
              {/* Age Distribution */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Age Distribution</h3>
                <div className="space-y-3">
                  {demographics.ageGroups.map((group) => (
                    <div key={group.name} className="flex items-center gap-3">
                      <div className="w-20 text-sm font-medium text-gray-700">{group.name}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden">
                            <div
                              className="bg-indigo-600 h-full flex items-center justify-center text-white text-xs font-medium"
                              style={{ width: `${(group.value / demographics.totalUsers) * 100}%` }}
                            >
                              {group.value > 0 && group.value}
                            </div>
                          </div>
                          <div className="w-12 text-sm text-gray-600">
                            {Math.round((group.value / demographics.totalUsers) * 100)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gender & Immigration Status */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Gender Distribution */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Gender Distribution</h3>
                  <div className="space-y-3">
                    {demographics.genderDistribution.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-6 overflow-hidden">
                            <div
                              className="bg-purple-600 h-full flex items-center justify-center text-white text-xs font-medium"
                              style={{ width: `${(item.value / demographics.totalUsers) * 100}%` }}
                            >
                              {Math.round((item.value / demographics.totalUsers) * 100)}%
                            </div>
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-8">{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Immigration Status */}
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">Immigration Status</h3>
                  <div className="space-y-3">
                    {demographics.immigrationStatus.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700 truncate max-w-[150px]">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-32 bg-gray-200 rounded-full h-6 overflow-hidden">
                            <div
                              className="bg-teal-600 h-full flex items-center justify-center text-white text-xs font-medium"
                              style={{ width: `${(item.value / demographics.totalUsers) * 100}%` }}
                            >
                              {Math.round((item.value / demographics.totalUsers) * 100)}%
                            </div>
                          </div>
                          <span className="text-sm font-medium text-gray-900 w-8">{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Top Nationalities */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Top 10 Nationalities</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {demographics.nationalityDistribution.map((item, idx) => (
                    <div key={idx} className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
                      <div className="text-2xl font-bold text-indigo-600 mb-1">{item.value}</div>
                      <div className="text-xs text-center text-gray-600">{item.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Accommodation Tab */}
          {activeTab === 'accommodation' && (
            <div className="space-y-6">
              {/* Property Occupancy */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Property Occupancy Rates</h3>
                <div className="space-y-4">
                  {accommodation.propertyOccupancy.map((prop, idx) => (
                    <div key={idx} className="border-b border-gray-200 pb-4 last:border-0">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{prop.name}</span>
                        <span className="text-sm text-gray-600">{prop.occupied} / {prop.total} rooms</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-8 overflow-hidden relative" style={{ minHeight: '32px' }}>
                          <div
                            className="bg-green-600 h-full flex items-center justify-center text-white text-xs font-medium"
                            style={{ width: `${prop.rate}%` }}
                          >
                            {prop.rate}%
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Room Types and Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Room Types */}
                {accommodation.roomTypes.length > 0 && (
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Room Types</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {accommodation.roomTypes.map((type, idx) => (
                        <div key={idx} className="p-4 bg-white rounded-lg shadow-sm text-center hover:shadow-md transition-shadow">
                          <div className="text-2xl font-bold text-indigo-600 mb-1">{type.value}</div>
                          <div className="text-sm text-gray-600">{type.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Summary Stats */}
                <div className="space-y-3">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 border border-green-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Occupied Rooms</p>
                        <p className="text-2xl font-bold text-gray-900">{accommodation.occupiedRooms}</p>
                      </div>
                      <Bed className="w-8 h-8 text-green-500" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Available Rooms</p>
                        <p className="text-2xl font-bold text-gray-900">{accommodation.totalRooms - accommodation.occupiedRooms}</p>
                      </div>
                      <Home className="w-8 h-8 text-blue-500" />
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Occupancy Rate</p>
                        <p className="text-2xl font-bold text-gray-900">{accommodation.occupancyRate}%</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-purple-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Available Reports</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="p-4 bg-white border border-gray-200 rounded-xl hover:border-teal-400 hover:shadow-lg transition-all cursor-pointer">
                    <PieChart className="w-8 h-8 text-indigo-600 mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-2">Demographics Report</h4>
                    <p className="text-sm text-gray-600 mb-3">Comprehensive breakdown of service user demographics.</p>
                    <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                      Generate Report →
                    </button>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-xl hover:border-teal-400 hover:shadow-lg transition-all cursor-pointer">
                    <PieChart className="w-8 h-8 text-indigo-600 mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-2">Demographics Report</h4>
                    <p className="text-sm text-gray-600 mb-3">Comprehensive breakdown of service user demographics.</p>
                    <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                      Generate Report →
                    </button>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-xl hover:border-teal-400 hover:shadow-lg transition-all cursor-pointer">
                    <Home className="w-8 h-8 text-teal-600 mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-2">Accommodation Report</h4>
                    <p className="text-sm text-gray-600 mb-3">Detailed occupancy statistics and property performance.</p>
                    <button className="text-sm text-teal-600 hover:text-teal-700 font-medium">
                      Generate Report →
                    </button>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer">
                    <Users className="w-8 h-8 text-blue-600 mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-2">Service User Summary</h4>
                    <p className="text-sm text-gray-600 mb-3">Complete list of active service users with details.</p>
                    <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                      Generate Report →
                    </button>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-xl hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer">
                    <TrendingUp className="w-8 h-8 text-purple-600 mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-2">Move In/Out Report</h4>
                    <p className="text-sm text-gray-600 mb-3">Historical data on service user admissions and departures.</p>
                    <button className="text-sm text-purple-600 hover:text-purple-700 font-medium">
                      Generate Report →
                    </button>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-xl hover:border-orange-400 hover:shadow-lg transition-all cursor-pointer">
                    <Calendar className="w-8 h-8 text-orange-600 mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-2">Vulnerability Assessment</h4>
                    <p className="text-sm text-gray-600 mb-3">Analysis of vulnerabilities across the population.</p>
                    <button className="text-sm text-orange-600 hover:text-orange-700 font-medium">
                      Generate Report →
                    </button>
                  </div>

                  <div className="p-4 bg-white border border-gray-200 rounded-xl hover:border-pink-400 hover:shadow-lg transition-all cursor-pointer">
                    <BarChart3 className="w-8 h-8 text-pink-600 mb-3" />
                    <h4 className="font-semibold text-gray-900 mb-2">Custom Report</h4>
                    <p className="text-sm text-gray-600 mb-3">Build your own custom report with selected fields.</p>
                    <button className="text-sm text-pink-600 hover:text-pink-700 font-medium">
                      Generate Report →
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick Stats Table */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Quick Statistics</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-2 border-gray-300">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Metric</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Value</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Percentage</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-gray-900">Total Service Users</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{demographics.totalUsers}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 text-right">100%</td>
                      </tr>
                      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-gray-900">Active Users</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{demographics.activeUsers}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 text-right">
                          {demographics.totalUsers > 0 ? Math.round((demographics.activeUsers / demographics.totalUsers) * 100) : 0}%
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-gray-900">Moved Out</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{demographics.movedOut}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 text-right">
                          {demographics.totalUsers > 0 ? Math.round((demographics.movedOut / demographics.totalUsers) * 100) : 0}%
                        </td>
                      </tr>
                      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-gray-900">Total Properties</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{accommodation.totalProperties}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 text-right">-</td>
                      </tr>
                      <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-gray-900">Total Rooms</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{accommodation.totalRooms}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 text-right">-</td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-gray-900">Occupied Rooms</td>
                        <td className="py-3 px-4 text-sm text-gray-900 text-right font-medium">{accommodation.occupiedRooms}</td>
                        <td className="py-3 px-4 text-sm text-gray-600 text-right">{accommodation.occupancyRate}%</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
