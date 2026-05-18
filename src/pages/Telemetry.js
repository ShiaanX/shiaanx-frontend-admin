import React, { useEffect, useState } from 'react';
import { FiActivity, FiRefreshCw, FiClock, FiDatabase, FiFilter, FiCalendar, FiCode, FiChevronDown } from 'react-icons/fi';
import telemetryService from '../services/telemetryService';
import toast from 'react-hot-toast';

function Telemetry() {
  const [data, setData] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingPrograms, setLoadingPrograms] = useState(false);
  const [limit, setLimit] = useState(100);
  const [pagination, setPagination] = useState({
    nextCursor: null,
    hasNextPage: false
  });
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    programName: '',
    range: '-2d'
  });

  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false);
  const [mappings, setMappings] = useState([]);
  const [mappingForm, setMappingForm] = useState({ program: '', toolName: '' });
  const [isSavingMapping, setIsSavingMapping] = useState(false);

  const fetchTelemetry = async (cursor = null) => {
    try {
      // Ignore event objects passed accidentally via onClick
      const actualCursor = (cursor && typeof cursor !== 'object') ? String(cursor) : null;
      const isLoadMore = !!actualCursor;
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const params = { limit };
      if (actualCursor) params.cursor = actualCursor;
      
      // Only send range if no specific dates are selected
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
      
      if (isLoadMore) {
        setData(prev => [...prev, ...(response.data || [])]);
      } else {
        setData(response.data || []);
      }

      setPagination(response.pagination || { nextCursor: null, hasNextPage: false });
    } catch (err) {
      toast.error(err.message || 'Failed to fetch telemetry data');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
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

  const fetchMappings = async () => {
    try {
      const response = await telemetryService.getMappings();
      setMappings(response.data || []);
    } catch (err) {
      console.error('Failed to fetch mappings:', err);
    }
  };

  const handleMappingSubmit = async (e) => {
    e.preventDefault();
    if (!mappingForm.program || !mappingForm.toolName) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      setIsSavingMapping(true);
      await telemetryService.upsertMapping({
        program_name: mappingForm.program,
        tool_name: mappingForm.toolName,
        sync_historical: true
      });
      toast.success(`Rule saved! Historical data for ${mappingForm.program} is being updated.`);
      setMappingForm({ program: '', toolName: '' });
      fetchMappings();
      // Wait a bit and refresh telemetry to show new tool names
      setTimeout(fetchTelemetry, 2000);
    } catch (err) {
      toast.error(err.message || 'Failed to save mapping');
    } finally {
      setIsSavingMapping(false);
    }
  };

  const handleDeleteMapping = async (id) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      await telemetryService.deleteMapping(id);
      toast.success('Mapping deleted');
      fetchMappings();
    } catch (err) {
      toast.error('Failed to delete mapping');
    }
  };

  useEffect(() => {
    fetchTelemetry();
    fetchPrograms();
    fetchMappings();
  }, [limit]); // Fetch on limit change

  const columns = React.useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const preferredOrder = [
      'factory_id', 'machine_id', 'program_name', 'tool_number', 'tool_name',
      'alarm_active', 'machine_state', 'machine_mode', 'program_runtime',
      'spindle_speed', 'spindle_override', 'feed_rate', 'feed_override',
      'axis_x', 'axis_y', 'axis_z'
    ];

    const allKeys = new Set();
    data.forEach(row => {
      Object.keys(row).forEach(key => {
        if (key !== '_time') allKeys.add(key);
      });
    });

    return Array.from(allKeys).sort((a, b) => {
      const indexA = preferredOrder.indexOf(a);
      const indexB = preferredOrder.indexOf(b);
      
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [data]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    
    setFilters(prev => {
        const newFilters = { ...prev, [name]: value };
        
        // If range is selected, clear dates
        if (name === 'range' && value !== 'custom') {
            newFilters.startDate = '';
            newFilters.endDate = '';
        }
        
        // If dates are changed, set range to custom
        if ((name === 'startDate' || name === 'endDate') && value !== '') {
            newFilters.range = 'custom';
        }
        
        return newFilters;
    });
  };

  const resetFilters = () => {
    setFilters({ startDate: '', endDate: '', programName: '', range: '-2d' });
    setLimit(100);
  };

  const getExportParams = () => {
      const params = {};
      if (filters.startDate || filters.endDate) {
          if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
          if (filters.endDate) params.endDate = new Date(filters.endDate).toISOString();
      } else {
          params.range = filters.range;
      }
      if (filters.programName) params.programName = filters.programName;
      return params;
  };

  return (
    <div className="telemetry-content" style={{ padding: '2rem' }}>
      <div className="page-header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#2d3748', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FiActivity color="var(--primary)" /> Machine Telemetry
          </h1>
          <p style={{ color: '#718096', marginTop: '0.5rem' }}>Raw data from CNC machines via MQTT</p>
        </div>
        
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
                className="btn-secondary" 
                onClick={() => setIsMappingModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', backgroundColor: '#fff', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
                <FiCode /> Program Tool Mapping
            </button>
            <button 
                className="btn-primary" 
                onClick={() => window.open(telemetryService.getExportUrl(getExportParams()), '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
                Export All Data (CSV)
            </button>
            <button 
                className="btn-secondary" 
                onClick={() => fetchTelemetry()}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', backgroundColor: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} /> {loading ? 'Fetching...' : 'Refresh'}
            </button>
        </div>
      </div>

      {/* Mapping Modal */}
      {isMappingModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: 'white', padding: '2rem', borderRadius: '16px', width: '90%', maxWidth: '600px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Program Tool Mappings</h2>
              <button onClick={() => setIsMappingModalOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
            </div>

            <form onSubmit={handleMappingSubmit} style={{ marginBottom: '2rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Add New Rule</h3>
              <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Select Program</label>
                  <select 
                    value={mappingForm.program} 
                    onChange={e => setMappingForm({...mappingForm, program: e.target.value})}
                    style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="">-- Choose Program --</option>
                    {programs.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: 600 }}>Manual Tool Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Roughing End Mill 10mm"
                    value={mappingForm.toolName}
                    onChange={e => setMappingForm({...mappingForm, toolName: e.target.value})}
                    style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isSavingMapping}
                  style={{ marginTop: '0.5rem', padding: '0.75rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {isSavingMapping ? 'Saving & Syncing...' : 'Save Rule & Sync History'}
                </button>
              </div>
            </form>

            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>Existing Rules</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '0.5rem', fontSize: '0.875rem' }}>Program</th>
                    <th style={{ padding: '0.5rem', fontSize: '0.875rem' }}>Tool Name</th>
                    <th style={{ padding: '0.5rem' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map(m => (
                    <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem' }}>{m.program_name}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem' }}>{m.tool_name}</td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        <button onClick={() => handleDeleteMapping(m.id)} style={{ color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {mappings.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '1rem', color: '#718096' }}>No mapping rules defined.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <FiFilter color="#4a5568" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#4a5568', margin: 0 }}>Filters</h3>
          </div>
          
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#718096' }}>Quick Range</label>
                  <div style={{ position: 'relative' }}>
                    <select 
                        name="range"
                        value={filters.range}
                        onChange={handleFilterChange}
                        style={{ padding: '0.625rem 2.5rem 0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem', appearance: 'none', backgroundColor: 'white', minWidth: '150px' }}
                    >
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
                  <input 
                    type="datetime-local" 
                    name="startDate"
                    value={filters.startDate}
                    onChange={handleFilterChange}
                    style={{ padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem' }} 
                  />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#718096' }}>End Date/Time</label>
                  <input 
                    type="datetime-local" 
                    name="endDate"
                    value={filters.endDate}
                    onChange={handleFilterChange}
                    style={{ padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem' }} 
                  />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#718096' }}>Program Name</label>
                  <div style={{ position: 'relative' }}>
                    <select 
                        name="programName"
                        value={filters.programName}
                        onChange={handleFilterChange}
                        style={{ padding: '0.625rem 2.5rem 0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem', appearance: 'none', backgroundColor: 'white', minWidth: '200px' }}
                    >
                        <option value="">All Programs</option>
                        {loadingPrograms ? (
                            <option disabled>Loading...</option>
                        ) : (
                            programs.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))
                        )}
                    </select>
                    <FiChevronDown style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#a0aec0' }} />
                  </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#718096' }}>Records Limit</label>
                  <select 
                    value={limit} 
                    onChange={(e) => setLimit(Number(e.target.value))}
                    style={{ padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none', fontSize: '0.875rem', minWidth: '120px' }}
                  >
                    <option value={50}>Latest 50</option>
                    <option value={100}>Latest 100</option>
                    <option value={500}>Latest 500</option>
                    <option value={1000}>Latest 1000</option>
                  </select>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button 
                    onClick={() => fetchTelemetry()}
                    style={{ padding: '0.625rem 1.5rem', backgroundColor: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Apply Filters
                  </button>
                  <button 
                    onClick={resetFilters}
                    style={{ padding: '0.625rem 1rem', backgroundColor: 'transparent', color: '#718096', border: '1px solid #e2e8f0', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Reset
                  </button>
              </div>
          </div>
      </div>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#ebf8ff', color: '#3182ce', borderRadius: '12px' }}><FiClock size={20}/></div>
              <div>
                  <span style={{ display: 'block', fontSize: '0.875rem', color: '#718096' }}>Frequency</span>
                  <span style={{ fontWeight: 700 }}>Every 1s</span>
              </div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#f0fff4', color: '#38a169', borderRadius: '12px' }}><FiDatabase size={20}/></div>
              <div>
                  <span style={{ display: 'block', fontSize: '0.875rem', color: '#718096' }}>Storage</span>
                  <span style={{ fontWeight: 700 }}>InfluxDB</span>
              </div>
          </div>
          <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '0.75rem', backgroundColor: '#fff5f5', color: '#e53e3e', borderRadius: '12px' }}><FiActivity size={20}/></div>
              <div>
                  <span style={{ display: 'block', fontSize: '0.875rem', color: '#718096' }}>Current Filter</span>
                  <span style={{ fontWeight: 700, color: '#3182ce' }}>{data.length} records</span>
              </div>
          </div>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#4a5568', fontSize: '0.875rem' }}>Timestamp</th>
                {columns.map(col => (
                  <th key={col} style={{ padding: '1.25rem 1.5rem', fontWeight: 700, color: '#4a5568', fontSize: '0.875rem', textTransform: 'capitalize' }}>
                    {col.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                          <FiRefreshCw className="animate-spin" size={32} />
                          <span>Loading telemetry data from InfluxDB...</span>
                      </div>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '4rem', color: '#718096' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                          <FiDatabase size={32} opacity={0.5} />
                          <span>No data found for the selected range.</span>
                      </div>
                  </td>
                </tr>
              ) : (
                data.map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#4a5568', fontWeight: 500 }}>
                      {new Date(row._time).toLocaleString('en-GB')}
                    </td>
                    {columns.map(col => (
                      <td key={col} style={{ padding: '1rem 1.5rem', fontSize: '0.875rem', color: '#2d3748' }}>
                        {typeof row[col] === 'number' ? row[col].toFixed(2) : row[col]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {pagination.hasNextPage && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem', borderTop: '1px solid #f1f5f9' }}>
            <button
              onClick={() => fetchTelemetry(pagination.nextCursor)}
              disabled={loadingMore}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 2rem',
                backgroundColor: 'white',
                color: 'var(--primary)',
                border: '1px solid var(--primary)',
                borderRadius: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = 'var(--primary)';
                e.currentTarget.style.color = 'white';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.color = 'var(--primary)';
              }}
            >
              {loadingMore ? (
                <>
                  <FiRefreshCw className="animate-spin" />
                  <span>Loading More...</span>
                </>
              ) : (
                <>
                  <span>Load More Records</span>
                  <FiChevronDown />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Telemetry;
