import React, { useEffect, useState } from 'react';
import { FiBarChart, FiRefreshCw, FiList, FiFilter, FiChevronDown, FiDatabase, FiActivity, FiCpu, FiPlay } from 'react-icons/fi';
import telemetryService from '../services/telemetryService';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar, RadialBarChart, RadialBar } from 'recharts';
import './TelemetryAnalyticsPublic.css';

/* ─── colour helpers ─── */
const flagColor = (pct, thresholds = { red: 50, amber: 70 }) => {
  if (pct >= thresholds.amber) return { color: '#16A34A', bg: '#DCFCE7', label: 'GREEN' };
  if (pct >= thresholds.red) return { color: '#D97706', bg: '#FEF3C7', label: 'AMBER' };
  return { color: '#DC2626', bg: '#FEE2E2', label: 'RED' };
};

const interventionFlag = (pct) => {
  if (pct > 35) return { color: '#DC2626', bg: '#FEE2E2', label: 'RED' };
  if (pct > 15) return { color: '#D97706', bg: '#FEF3C7', label: 'AMBER' };
  return { color: '#16A34A', bg: '#DCFCE7', label: 'GREEN' };
};

const quoteAccuracyFlag = (idx) => {
  if (idx > 1.3) return { color: '#DC2626', bg: '#FEE2E2', label: 'RED' };
  if (idx >= 0.9 && idx <= 1.1) return { color: '#16A34A', bg: '#DCFCE7', label: 'GREEN' };
  return { color: '#D97706', bg: '#FEF3C7', label: 'AMBER' };
};

/* ─── Mini Gauge component ─── */
const MiniGauge = ({ value, max = 100, label, flagFn }) => {
  const pct = Math.min((value / max) * 100, 100);
  const flag = flagFn ? flagFn(value) : flagColor(value);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#e5e7eb" strokeWidth="3" />
          <circle cx="18" cy="18" r="15.9155" fill="none" stroke={flag.color} strokeWidth="3"
            strokeDasharray={`${pct}, 100`} strokeLinecap="round" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.8rem', color: flag.color }}>
          {typeof value === 'number' ? value.toFixed(1) : value}
        </div>
      </div>
      {label && <span style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center' }}>{label}</span>}
    </div>
  );
};

function PublicAnalytics() {
  const [summary, setSummary] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingTrend, setLoadingTrend] = useState(true);
  const [selectedTab, setSelectedTab] = useState('summary'); // 'summary' | 'programme' | 'table'
  const [rawData, setRawData] = useState([]);
  const [loadingRaw, setLoadingRaw] = useState(true);
  const [pagination, setPagination] = useState({ nextCursor: null, hasNextPage: false });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    programName: '',
    range: '-2d'
  });
  const [limit, setLimit] = useState(100);
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [machineMatrix, setMachineMatrix] = useState([]);
  const [loadingMatrix, setLoadingMatrix] = useState(true);
  const [expandedMachineGaps, setExpandedMachineGaps] = useState({});

  // Programme-level state
  const [selectedProgram, setSelectedProgram] = useState('');
  const [programMetrics, setProgramMetrics] = useState(null);
  const [loadingProgramMetrics, setLoadingProgramMetrics] = useState(false);

  // Fetch summary KPIs
  const fetchSummary = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filters.startDate || filters.endDate) {
        if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
        if (filters.endDate) params.endDate = new Date(filters.endDate).toISOString();
      } else {
        params.range = filters.range;
      }
      const res = await telemetryService.getAnalyticsSummary(params);
      setSummary(res.data || {});
    } catch (e) {
      console.error('Failed to fetch summary', e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch machine level matrix
  const fetchMachineMatrix = async () => {
    try {
      setLoadingMatrix(true);
      const params = {};
      if (filters.startDate || filters.endDate) {
        if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
        if (filters.endDate) params.endDate = new Date(filters.endDate).toISOString();
      } else {
        params.range = filters.range;
      }
      const res = await telemetryService.getMachineMatrix(params);
      setMachineMatrix(res.data || []);
    } catch (e) {
      console.error('Failed to fetch machine matrix', e);
    } finally {
      setLoadingMatrix(false);
    }
  };

  const toggleGapDetails = (machineId) => {
    setExpandedMachineGaps(prev => ({
      ...prev,
      [machineId]: !prev[machineId]
    }));
  };

  const fetchPrograms = async () => {
    try {
      setLoadingPrograms(true);
      const response = await telemetryService.getPrograms();
      setPrograms(response.data || []);
    } catch (err) {
      console.error('Failed to fetch programs:', err);
    } finally {
      setLoadingPrograms(false);
    }
  };

  // Fetch programme-level metrics
  const fetchProgramMetrics = async (progName) => {
    if (!progName) return;
    try {
      setLoadingProgramMetrics(true);
      const params = { programName: progName };
      if (filters.startDate || filters.endDate) {
        if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
        if (filters.endDate) params.endDate = new Date(filters.endDate).toISOString();
      } else {
        params.range = filters.range || '-30d';
      }
      const res = await telemetryService.getProgramMetrics(params);
      setProgramMetrics(res.data || null);
    } catch (e) {
      console.error('Failed to fetch programme metrics', e);
    } finally {
      setLoadingProgramMetrics(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => {
      const newFilters = { ...prev, [name]: value };
      if (name === 'range' && value !== 'custom') {
        newFilters.startDate = '';
        newFilters.endDate = '';
      }
      if ((name === 'startDate' || name === 'endDate') && value !== '') {
        newFilters.range = 'custom';
      }
      return newFilters;
    });
  };

  const resetFilters = () => {
    const defaultFilters = { startDate: '', endDate: '', programName: '', range: '-2d' };
    setFilters(defaultFilters);
    setLimit(100);
    const params = { range: '-2d' };
    telemetryService.getAnalyticsSummary(params).then(res => setSummary(res.data || {}));
    telemetryService.getMachineMatrix(params).then(res => setMachineMatrix(res.data || []));
    telemetryService.getRawTelemetry({ limit: 100, range: '-2d' }).then(response => {
      setRawData(response.data || []);
      setPagination(response.pagination || { nextCursor: null, hasNextPage: false });
    });
  };

  const handleApplyFilters = () => {
    fetchSummary();
    fetchMachineMatrix();
    fetchTelemetry();
  };

  // Fetch spindle speed trend (last 24h by default)
  const fetchTrend = async () => {
    try {
      const res = await telemetryService.getSpindleTrend({ range: '-24h' });
      // Convert timestamps to Date objects for recharts
      const formatted = (res.data || []).map(item => ({
        time: new Date(item.timestamp).toLocaleString('en-GB'),
        speed: item.spindle_speed,
      }));
      setTrendData(formatted);
    } catch (e) {
      console.error('Failed to fetch trend', e);
    } finally {
      setLoadingTrend(false);
    }
  };

  // Fetch raw telemetry data for the table view
  const fetchTelemetry = async (cursor = null) => {
    try {
      const params = { limit };
      if (cursor) params.cursor = cursor;
      // Apply filters
      if (filters.startDate || filters.endDate) {
        if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
        if (filters.endDate) params.endDate = new Date(filters.endDate).toISOString();
      } else {
        params.range = filters.range;
      }
      if (filters.programName) {
        params.programName = filters.programName;
      }
      const response = await telemetryService.getRawTelemetry(params);
      if (cursor) {
        setRawData(prev => [...prev, ...(response.data || [])]);
      } else {
        setRawData(response.data || []);
      }
      setPagination(response.pagination || { nextCursor: null, hasNextPage: false });
    } catch (err) {
      console.error('Failed to fetch telemetry', err);
    } finally {
      setLoadingRaw(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    fetchMachineMatrix();
    // fetchTrend(); // commented out to save API calls
    fetchTelemetry();
    fetchPrograms();
  }, [limit]);

  /* ─── helper: format seconds to human readable ─── */
  const formatDuration = (seconds) => {
    if (!seconds || seconds <= 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.round(seconds % 60);
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  /* ─── Styles ─── */
  const cardStyle = {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '16px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem'
  };
  const cardTitleStyle = { display: 'block', fontSize: '0.875rem', color: '#718096' };
  const cardValueStyle = { fontWeight: 700, fontSize: '1.1rem' };
  const sectionHeaderStyle = { marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600, marginTop: '2rem' };
  const tabBtnStyle = (active) => ({
    backgroundColor: active ? 'var(--primary)' : '#f0f0f0',
    color: active ? 'white' : '#333',
    border: 'none',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    fontWeight: 600,
    fontSize: '0.875rem',
    transition: 'all 0.2s',
  });

  /* ─── DONUT COLORS ─── */
  const DONUT_COLORS = ['#6B7280', '#2563EB', '#DC2626'];
  const MATURITY_COLORS = ['#2563EB', '#DC2626', '#D97706'];

  return (
    <div className="telemetry-content" style={{ padding: '2rem' }}>
      <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem', fontWeight: 600 }}>
        <FiBarChart size={24} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
        Public Analytics
      </h2>

      {/* Tab bar */}
      <div className="tab-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button onClick={() => setSelectedTab('summary')} style={tabBtnStyle(selectedTab === 'summary')}>
          <FiBarChart size={14} /> Summary
        </button>
        <button onClick={() => setSelectedTab('programme')} style={tabBtnStyle(selectedTab === 'programme')}>
          <FiPlay size={14} /> Programme Metrics
        </button>
        <button onClick={() => setSelectedTab('table')} style={tabBtnStyle(selectedTab === 'table')}>
          <FiList size={14} /> Data Table
        </button>
      </div>

      {/* ═══════════════════ SUMMARY TAB ═══════════════════ */}
      {selectedTab === 'summary' && (
        <>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <FiRefreshCw className="animate-spin" size={24} /> Loading analytics summary...
            </div>
          ) : (
            <>
              <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={cardStyle}>
                  <div style={{ padding: '0.75rem', backgroundColor: '#ebf8ff', color: '#3182ce', borderRadius: '12px' }}><FiBarChart size={20} /></div>
                  <div>
                    <span style={cardTitleStyle}>Total Records (24h)</span>
                    <span style={cardValueStyle}>{summary?.totalRecords || 0}</span>
                  </div>
                </div>
                <div style={cardStyle}>
                  <div style={{ padding: '0.75rem', backgroundColor: '#f0fff4', color: '#38a169', borderRadius: '12px' }}><FiBarChart size={20} /></div>
                  <div>
                    <span style={cardTitleStyle}>Avg Spindle Speed</span>
                    <span style={cardValueStyle}>{(summary?.avgSpindleSpeed || 0).toFixed(2)}</span>
                  </div>
                </div>
                <div style={cardStyle}>
                  <div style={{ padding: '0.75rem', backgroundColor: '#fff5f5', color: '#e53e3e', borderRadius: '12px' }}><FiBarChart size={20} /></div>
                  <div>
                    <span style={cardTitleStyle}>Max Cycle Time</span>
                    <span style={cardValueStyle}>{summary?.maxCycleTime?.toFixed(2) || 0}</span>
                  </div>
                </div>
                <div style={cardStyle}>
                  <div style={{ padding: '0.75rem', backgroundColor: '#fefcbf', color: '#d69e2e', borderRadius: '12px' }}><FiBarChart size={20} /></div>
                  <div>
                    <span style={cardTitleStyle}>Total Production</span>
                    <span style={cardValueStyle}>{summary?.totalProductionCount || 0}</span>
                  </div>
                </div>
              </div>
              {/* Additional KPI Cards */}
              <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                {/* Machine Utilisation KPI with gauge placeholder */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ fontSize: '0.875rem', color: '#718096' }}>Machine Utilisation %</div>
                  <MiniGauge value={summary?.machineUtilisationPct || 0} label="" flagFn={flagColor} />
                </div>
                {/* Session Productive Time KPI */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.875rem', color: '#718096' }}>Session Productive Time</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{formatDuration(summary?.sessionProductiveTime || 0)}</div>
                </div>
                {/* Alarm Event Count KPI */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.875rem', color: '#718096' }}>Alarm Event Count</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: summary?.alarmEventCount > 0 ? '#e53e3e' : '#38a169' }}>{summary?.alarmEventCount || 0}</div>
                </div>
                {/* Feed Override Events KPI */}
                <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                  <div style={{ fontSize: '0.875rem', color: '#718096' }}>Feed Override Events</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{summary?.feedOverrideEvents || 0}</div>
                </div>
              </div>
              {/* Machine State Distribution Donut Chart */}
              <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem', fontWeight: 600 }}>Machine State Distribution</h3>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <PieChart width={320} height={280}>
                    <Pie data={[
                      { name: 'Idle (State 0)', value: summary?.machineStateDistribution?.state0Pct || 0 },
                      { name: 'Running (State 1)', value: summary?.machineStateDistribution?.state1Pct || 0 },
                      { name: 'M00 Stop (State 2)', value: summary?.machineStateDistribution?.state2Pct || 0 },
                    ]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={100} label={({ name, value }) => `${value.toFixed(1)}%`}>
                      {DONUT_COLORS.map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => `${val.toFixed(2)}%`} />
                    <Legend />
                  </PieChart>
                </div>
              </div>
            </>
          )}

          {/* Machine Level Matrix */}
          <h3 style={sectionHeaderStyle}>Machine Level Matrix</h3>
          {loadingMatrix ? (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <FiRefreshCw className="animate-spin" size={24} /> Loading machine matrix data...
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#4a5568', fontSize: '0.875rem' }}>Machine ID</th>
                      <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#4a5568', fontSize: '0.875rem' }}>Machine Utilisation</th>
                      <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#4a5568', fontSize: '0.875rem' }}>Productive Time</th>
                      <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#4a5568', fontSize: '0.875rem' }}>Alarms</th>
                      <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#4a5568', fontSize: '0.875rem' }}>Feed Override Events</th>
                      <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#4a5568', fontSize: '0.875rem' }}>State Distribution</th>
                      <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#4a5568', fontSize: '0.875rem' }}>Idle Gap Alerts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {machineMatrix.map((mach) => {
                      const utilFlag = flagColor(mach.utilisationPct);
                      const alarmColor = mach.alarmEventCount > 0 ? '#DC2626' : '#16A34A';
                      const alarmBg = mach.alarmEventCount > 0 ? '#FEE2E2' : '#DCFCE7';
                      const feedColor = mach.feedOverrideEvents > 100 ? '#D97706' : '#475569';
                      const feedBg = mach.feedOverrideEvents > 100 ? '#FEF3C7' : '#F1F5F9';

                      return (
                        <React.Fragment key={mach.machine_id}>
                          <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{mach.machine_id}</td>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color: utilFlag.color, backgroundColor: utilFlag.bg }}>
                                {mach.utilisationPct.toFixed(2)}%
                              </span>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#334155' }}>
                              {formatDuration(mach.sessionProductiveTime)}
                            </td>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color: alarmColor, backgroundColor: alarmBg }}>
                                {mach.alarmEventCount} events
                              </span>
                            </td>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color: feedColor, backgroundColor: feedBg }}>
                                {mach.feedOverrideEvents}
                              </span>
                            </td>
                            <td style={{ padding: '1rem 1.5rem', minWidth: '180px' }}>
                              <div style={{ display: 'flex', height: '10px', borderRadius: '9999px', overflow: 'hidden', backgroundColor: '#e2e8f0', marginBottom: '0.25rem' }}>
                                <div style={{ width: `${mach.stateDistribution.idle}%`, backgroundColor: '#6B7280' }} title={`Idle: ${mach.stateDistribution.idle}%`} />
                                <div style={{ width: `${mach.stateDistribution.running}%`, backgroundColor: '#2563EB' }} title={`Running: ${mach.stateDistribution.running}%`} />
                                <div style={{ width: `${mach.stateDistribution.error}%`, backgroundColor: '#DC2626' }} title={`Error: ${mach.stateDistribution.error}%`} />
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#64748b', fontWeight: 500 }}>
                                <span>I: {mach.stateDistribution.idle}%</span>
                                <span>R: {mach.stateDistribution.running}%</span>
                                <span>E: {mach.stateDistribution.error}%</span>
                              </div>
                            </td>
                            <td style={{ padding: '1rem 1.5rem' }}>
                              {mach.hasLongIdleGap ? (
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color: '#DC2626', backgroundColor: '#FEE2E2' }}>
                                  Long Idle Gap (&gt;30m)
                                </span>
                              ) : (
                                <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color: '#16A34A', backgroundColor: '#DCFCE7' }}>
                                  No Gap Alert
                                </span>
                              )}
                              {mach.idleGaps && mach.idleGaps.length > 0 && (
                                <button
                                  onClick={() => toggleGapDetails(mach.machine_id)}
                                  style={{ marginLeft: '0.5rem', border: 'none', background: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}
                                >
                                  {expandedMachineGaps[mach.machine_id] ? 'Hide Gaps' : `View Gaps (${mach.idleGaps.length})`}
                                </button>
                              )}
                            </td>
                          </tr>
                          {expandedMachineGaps[mach.machine_id] && (
                            <tr>
                              <td colSpan={7} style={{ backgroundColor: '#f8fafc', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>Detected Idle Gaps (&gt; 5 min):</div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                                  {mach.idleGaps.map((gap, gIdx) => (
                                    <div key={gIdx} style={{ padding: '0.5rem 0.75rem', backgroundColor: gap.flag ? '#FEE2E2' : 'white', border: `1px solid ${gap.flag ? '#FCA5A5' : '#e2e8f0'}`, borderRadius: '8px', fontSize: '0.75rem', color: gap.flag ? '#991B1B' : '#334155' }}>
                                      <strong>Duration:</strong> {(gap.duration / 60).toFixed(1)} mins <br />
                                      <strong>Time:</strong> {new Date(gap.start).toLocaleTimeString('en-GB')} - {new Date(gap.end).toLocaleTimeString('en-GB')}
                                      {gap.flag && <span style={{ display: 'block', color: '#DC2626', fontWeight: 700, marginTop: '0.25rem' }}>⚠️ Flagged Working Hours Alert</span>}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ PROGRAMME METRICS TAB ═══════════════════ */}
      {selectedTab === 'programme' && (
        <>
          {/* Programme selector */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <FiCpu color="#4a5568" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#4a5568', margin: 0 }}>Select Programme</h3>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#718096' }}>Program Name</label>
                <div style={{ position: 'relative' }}>
                  <select
                    value={selectedProgram}
                    onChange={e => setSelectedProgram(e.target.value)}
                    style={{ padding: '0.625rem 2.5rem 0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem', appearance: 'none', backgroundColor: 'white', minWidth: '250px' }}
                  >
                    <option value="">-- Select a Programme --</option>
                    {loadingPrograms ? (<option disabled>Loading...</option>) : (programs.map(p => (<option key={p} value={p}>{p}</option>)))}
                  </select>
                  <FiChevronDown style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#a0aec0' }} />
                </div>
              </div>
              <button
                onClick={() => fetchProgramMetrics(selectedProgram)}
                disabled={!selectedProgram || loadingProgramMetrics}
                style={{ padding: '0.625rem 1.5rem', backgroundColor: selectedProgram ? 'var(--primary)' : '#cbd5e0', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: selectedProgram ? 'pointer' : 'not-allowed', transition: 'all 0.2s' }}
              >
                {loadingProgramMetrics ? 'Loading...' : 'Analyse Programme'}
              </button>
            </div>
          </div>

          {loadingProgramMetrics && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FiRefreshCw className="animate-spin" size={24} /> Analysing programme runs...
            </div>
          )}

          {programMetrics && !loadingProgramMetrics && (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '0.25rem' }}>
                  Programme: <span style={{ color: 'var(--primary)' }}>{programMetrics.programName}</span>
                </h3>
                <p style={{ fontSize: '0.875rem', color: '#64748b', margin: 0 }}>
                  {programMetrics.runs?.length || 0} run(s) detected &nbsp;|&nbsp;
                  CAM Estimated: {programMetrics.camEstimatedS ? `${programMetrics.camEstimatedS}s` : 'Not available'}
                </p>
              </div>

              {/* Per-run KPI cards */}
              {programMetrics.runs && programMetrics.runs.length > 0 && (
                <>
                  {/* Latest Run Summary KPI Cards */}
                  {(() => {
                    const latestRun = programMetrics.runs[programMetrics.runs.length - 1];
                    const irFlag = interventionFlag(latestRun.interventionRatio);
                    const utilFlag2 = flagColor(latestRun.programUtilisation);
                    const qai = programMetrics.camEstimatedS ? (latestRun.cycleTime / programMetrics.camEstimatedS) : null;
                    const qaiFlag = qai !== null ? quoteAccuracyFlag(qai) : null;

                    return (
                      <div style={{ marginBottom: '2rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', marginBottom: '1rem' }}>Latest Run (Run #{latestRun.run_number}) Summary</h4>
                        <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
                          {/* Cycle Time */}
                          <div style={{ ...cardStyle, flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <span style={cardTitleStyle}>Cycle Time</span>
                            <span style={{ ...cardValueStyle, fontSize: '1.4rem' }}>{latestRun.cycleTime}s</span>
                          </div>
                          {/* Programme Runtime */}
                          <div style={{ ...cardStyle, flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <span style={cardTitleStyle}>Programme Runtime</span>
                            <span style={{ ...cardValueStyle, fontSize: '1.4rem' }}>{formatDuration(latestRun.programRuntime)}</span>
                          </div>
                          {/* Intervention Ratio */}
                          <div style={{ ...cardStyle, flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <span style={cardTitleStyle}>Intervention Ratio</span>
                            <MiniGauge value={latestRun.interventionRatio} label="" flagFn={v => {
                              if (v > 35) return { color: '#DC2626', bg: '#FEE2E2' };
                              if (v > 15) return { color: '#D97706', bg: '#FEF3C7' };
                              return { color: '#16A34A', bg: '#DCFCE7' };
                            }} />
                            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', color: irFlag.color, backgroundColor: irFlag.bg, fontWeight: 700 }}>{irFlag.label}</span>
                          </div>
                          {/* M00 Stop Time */}
                          <div style={{ ...cardStyle, flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <span style={cardTitleStyle}>M00 Stop Time</span>
                            <span style={{ ...cardValueStyle, fontSize: '1.4rem', color: latestRun.m00StopTime > 600 ? '#D97706' : '#1e293b' }}>{formatDuration(latestRun.m00StopTime)}</span>
                            {latestRun.m00StopTime > 600 && <span style={{ fontSize: '0.65rem', color: '#D97706', fontWeight: 600 }}>⚠ &gt;10 min</span>}
                          </div>
                          {/* Programme Utilisation */}
                          <div style={{ ...cardStyle, flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <span style={cardTitleStyle}>Programme Utilisation</span>
                            <MiniGauge value={latestRun.programUtilisation} label="" flagFn={flagColor} />
                            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', color: utilFlag2.color, backgroundColor: utilFlag2.bg, fontWeight: 700 }}>{utilFlag2.label}</span>
                          </div>
                          {/* Quote Accuracy Index */}
                          <div style={{ ...cardStyle, flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                            <span style={cardTitleStyle}>Quote Accuracy Index</span>
                            {qai !== null ? (
                              <>
                                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: qaiFlag.color }}>{qai.toFixed(2)}</div>
                                <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '9999px', color: qaiFlag.color, backgroundColor: qaiFlag.bg, fontWeight: 700 }}>{qaiFlag.label}</span>
                              </>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>No CAM estimate</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* M00 Stop Time Timeline Bar */}
                  <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', marginBottom: '1rem' }}>M00 Stop Time per Run</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={programMetrics.runs.map(r => ({
                        name: `Run ${r.run_number}`,
                        m00StopTime: r.m00StopTime,
                        fill: r.m00StopTime > 600 ? '#D97706' : '#2563EB'
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'Seconds', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#94a3b8' } }} />
                        <Tooltip formatter={(val) => [`${formatDuration(val)}`, 'M00 Stop']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                        <Bar dataKey="m00StopTime" radius={[6, 6, 0, 0]}>
                          {programMetrics.runs.map((r, i) => (
                            <Cell key={i} fill={r.m00StopTime > 600 ? '#D97706' : '#2563EB'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Maturity Curve (multi-line chart) */}
                  <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
                    <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Maturity Curve</h4>
                    <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '1rem', marginTop: 0 }}>Cycle time, intervention ratio &amp; override events across runs</p>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={programMetrics.runs.map(r => ({
                        run: `Run ${r.run_number}`,
                        cycleTime: r.cycleTime,
                        interventionRatio: r.interventionRatio,
                        overrideEvents: r.overrideEvents,
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="run" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                        <Legend />
                        <Line yAxisId="left" type="monotone" dataKey="cycleTime" stroke={MATURITY_COLORS[0]} strokeWidth={2} dot={{ r: 4 }} name="Cycle Time (s)" />
                        <Line yAxisId="left" type="monotone" dataKey="interventionRatio" stroke={MATURITY_COLORS[1]} strokeWidth={2} dot={{ r: 4 }} name="Intervention Ratio (%)" />
                        <Line yAxisId="right" type="monotone" dataKey="overrideEvents" stroke={MATURITY_COLORS[2]} strokeWidth={2} dot={{ r: 4 }} name="Override Events" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Runs detail table */}
                  <div style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
                    <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
                      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#475569', margin: 0 }}>All Runs Detail</h4>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                          <tr>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#4a5568', fontSize: '0.8rem' }}>Run #</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#4a5568', fontSize: '0.8rem' }}>Start Time</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#4a5568', fontSize: '0.8rem' }}>End Time</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#4a5568', fontSize: '0.8rem' }}>Cycle Time</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#4a5568', fontSize: '0.8rem' }}>Runtime</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#4a5568', fontSize: '0.8rem' }}>Intervention %</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#4a5568', fontSize: '0.8rem' }}>M00 Stop</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#4a5568', fontSize: '0.8rem' }}>Utilisation %</th>
                            <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#4a5568', fontSize: '0.8rem' }}>Overrides</th>
                            {programMetrics.camEstimatedS > 0 && <th style={{ padding: '1rem 1.25rem', fontWeight: 700, color: '#4a5568', fontSize: '0.8rem' }}>QA Index</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {programMetrics.runs.map(run => {
                            const irF = interventionFlag(run.interventionRatio);
                            const uF = flagColor(run.programUtilisation);
                            const qaIdx = programMetrics.camEstimatedS ? (run.cycleTime / programMetrics.camEstimatedS) : null;
                            const qaF = qaIdx !== null ? quoteAccuracyFlag(qaIdx) : null;

                            return (
                              <tr key={run.run_number} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '0.875rem 1.25rem', fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }}>#{run.run_number}</td>
                                <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: '#475569' }}>{new Date(run.startTime).toLocaleString('en-GB')}</td>
                                <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.8rem', color: '#475569' }}>{new Date(run.endTime).toLocaleString('en-GB')}</td>
                                <td style={{ padding: '0.875rem 1.25rem', fontWeight: 600, fontSize: '0.85rem' }}>{run.cycleTime}s</td>
                                <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.85rem' }}>{formatDuration(run.programRuntime)}</td>
                                <td style={{ padding: '0.875rem 1.25rem' }}>
                                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color: irF.color, backgroundColor: irF.bg }}>
                                    {run.interventionRatio.toFixed(1)}%
                                  </span>
                                </td>
                                <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.85rem', color: run.m00StopTime > 600 ? '#D97706' : '#334155', fontWeight: run.m00StopTime > 600 ? 700 : 400 }}>
                                  {formatDuration(run.m00StopTime)}
                                </td>
                                <td style={{ padding: '0.875rem 1.25rem' }}>
                                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color: uF.color, backgroundColor: uF.bg }}>
                                    {run.programUtilisation.toFixed(1)}%
                                  </span>
                                </td>
                                <td style={{ padding: '0.875rem 1.25rem', fontSize: '0.85rem' }}>{run.overrideEvents}</td>
                                {programMetrics.camEstimatedS > 0 && (
                                  <td style={{ padding: '0.875rem 1.25rem' }}>
                                    <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color: qaF?.color, backgroundColor: qaF?.bg }}>
                                      {qaIdx?.toFixed(2)}
                                    </span>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {programMetrics.runs && programMetrics.runs.length === 0 && (
                <div style={{ backgroundColor: 'white', padding: '3rem', borderRadius: '16px', textAlign: 'center', color: '#94a3b8' }}>
                  <FiDatabase size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontWeight: 600 }}>No runs found for this programme in the selected time range.</p>
                </div>
              )}
            </>
          )}

          {!programMetrics && !loadingProgramMetrics && (
            <div style={{ backgroundColor: 'white', padding: '3rem', borderRadius: '16px', textAlign: 'center', color: '#94a3b8', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <FiActivity size={40} style={{ marginBottom: '1rem', opacity: 0.4 }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }}>Select a programme above to view per-run analytics</p>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>Includes cycle time, intervention ratio, M00 stop time, utilisation, quote accuracy &amp; maturity curve</p>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════ DATA TABLE TAB ═══════════════════ */}
      {selectedTab === 'table' && (
        <>
          {/* Filter UI */}
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <FiFilter color="#4a5568" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#4a5568', margin: 0 }}>Filters</h3>
            </div>
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#718096' }}>Quick Range</label>
                <div style={{ position: 'relative' }}>
                  <select name="range" value={filters.range} onChange={handleFilterChange} style={{ padding: '0.625rem 2.5rem 0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem', appearance: 'none', backgroundColor: 'white', minWidth: '150px' }}>
                    <option value="-1h">Last 1 Hour</option>
                    <option value="-6h">Last 6 Hours</option>
                    <option value="-12h">Last 12 Hours</option>
                    <option value="-1d">Last 24 Hours</option>
                    <option value="-2d">Last 2 Days</option>
                    <option value="-7d">Last 7 Days</option>
                    <option value="-30d">Last 30 Days</option>
                    <option value="custom" disabled={filters.range !== 'custom'}>Custom Range</option>
                  </select>
                  <FiChevronDown style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#a0aec0' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#718096' }}>Start Date/Time</label>
                <input type="datetime-local" name="startDate" value={filters.startDate} onChange={handleFilterChange} style={{ padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#718096' }}>End Date/Time</label>
                <input type="datetime-local" name="endDate" value={filters.endDate} onChange={handleFilterChange} style={{ padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#718096' }}>Program Name</label>
                <div style={{ position: 'relative' }}>
                  <select name="programName" value={filters.programName} onChange={handleFilterChange} style={{ padding: '0.625rem 2.5rem 0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem', appearance: 'none', backgroundColor: 'white', minWidth: '200px' }}>
                    <option value="">All Programs</option>
                    {loadingPrograms ? (<option disabled>Loading...</option>) : (programs.map(p => (<option key={p} value={p}>{p}</option>)))}
                  </select>
                  <FiChevronDown style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#a0aec0' }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#718096' }}>Records Limit</label>
                <select value={limit} onChange={e => setLimit(Number(e.target.value))} style={{ padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem', minWidth: '120px' }}>
                  <option value={50}>Latest 50</option>
                  <option value={100}>Latest 100</option>
                  <option value={500}>Latest 500</option>
                  <option value={1000}>Latest 1000</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={handleApplyFilters} style={{ padding: '0.625rem 1.5rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Apply Filters</button>
                <button onClick={resetFilters} style={{ padding: '0.625rem 1rem', backgroundColor: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>Reset</button>
              </div>
            </div>
          </div>

          {/* Raw data table */}
          {loadingRaw ? (
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <FiRefreshCw className="animate-spin" size={24} /> Loading raw telemetry data...
            </div>
          ) : (
            <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <tr>
                      <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#4a5568', fontSize: '0.875rem' }}>Timestamp</th>
                      {rawData[0] && Object.keys(rawData[0]).filter(k => k !== '_time').map(col => (
                        <th key={col} style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#4a5568', fontSize: '0.875rem' }}>{col.replace(/_/g, ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#4a5568', fontWeight: 500 }}>{new Date(row._time).toLocaleString('en-GB')}</td>
                        {Object.entries(row).filter(([k]) => k !== '_time').map(([k, v]) => (
                          <td key={k} style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#2d3748' }}>{typeof v === 'number' ? v.toFixed(2) : v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.hasNextPage && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', borderTop: '1px solid #f1f5f9' }}>
                  <button onClick={() => fetchTelemetry(pagination.nextCursor)} disabled={loadingRaw} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 2rem', backgroundColor: 'white', color: 'var(--primary)', border: '1px solid var(--primary)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                    Load More Records
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PublicAnalytics;
