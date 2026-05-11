import React, { useEffect, useState } from 'react';
import { FiActivity, FiRefreshCw, FiClock, FiDatabase, FiFilter, FiCalendar, FiCode } from 'react-icons/fi';
import telemetryService from '../services/telemetryService';
import toast from 'react-hot-toast';

function Telemetry() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(100);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    programName: ''
  });

  const fetchTelemetry = async () => {
    try {
      setLoading(true);
      const params = { limit };
      
      if (filters.startDate) {
        params.startDate = new Date(filters.startDate).toISOString();
      }
      if (filters.endDate) {
        params.endDate = new Date(filters.endDate).toISOString();
      }
      if (filters.programName) {
        params.programName = filters.programName;
      }

      const response = await telemetryService.getRawTelemetry(params);
      setData(response.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to fetch telemetry data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [limit]); // Fetch on limit change

  const columns = data.length > 0 ? Object.keys(data[0]).filter(k => k !== '_time') : [];

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({ startDate: '', endDate: '', programName: '' });
    setLimit(100);
  };

  const getExportParams = () => {
      const params = {};
      if (filters.startDate) params.startDate = new Date(filters.startDate).toISOString();
      if (filters.endDate) params.endDate = new Date(filters.endDate).toISOString();
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
                className="btn-primary" 
                onClick={() => window.open(telemetryService.getExportUrl(getExportParams()), '_blank')}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
                Export All Data (CSV)
            </button>
            <button 
                className="btn-secondary" 
                onClick={fetchTelemetry}
                disabled={loading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.25rem', backgroundColor: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
            >
                <FiRefreshCw className={loading ? 'animate-spin' : ''} /> {loading ? 'Fetching...' : 'Refresh'}
            </button>
        </div>
      </div>

      {/* Filters Section */}
      <div style={{ backgroundColor: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
              <FiFilter color="#4a5568" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#4a5568', margin: 0 }}>Filters</h3>
          </div>
          
          <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', backgroundColor: 'white' }}>
                    <FiCode color="#a0aec0" />
                    <input 
                        type="text" 
                        name="programName"
                        placeholder="Search program..."
                        value={filters.programName}
                        onChange={handleFilterChange}
                        style={{ border: 'none', outline: 'none', fontSize: '0.875rem', width: '150px' }} 
                    />
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
                    onClick={fetchTelemetry}
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
                      {new Date(row._time).toLocaleString()}
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
      </div>
    </div>
  );
}

export default Telemetry;
