// All communication with the backend goes through this file.
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const TOKEN_KEY = 'khata_token';
export const USER_KEY = 'khata_user';

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  } catch (err) {
    throw new Error('Cannot connect to the server. Please make sure the backend is running.');
  }

  let json = null;
  try {
    json = await res.json();
  } catch (err) {
    // response had no JSON body
  }

  if (!res.ok || !json || json.success === false) {
    // Expired or invalid session on a protected request: log the user out
    if (res.status === 401 && token) {
      window.dispatchEvent(new Event('khata-unauthorized'));
    }
    const error = new Error((json && json.message) || 'Something went wrong. Please try again.');
    error.status = res.status;
    throw error;
  }
  return json.data;
}

const api = {
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),

  getCustomers: (q = '') => request(`/customers?q=${encodeURIComponent(q)}`),
  addCustomer: (body) => request('/customers', { method: 'POST', body: JSON.stringify(body) }),

  getLedger: (id) => request(`/customers/${id}/ledger`),
  addTransaction: (customerId, body) =>
    request(`/customers/${customerId}/transactions`, { method: 'POST', body: JSON.stringify(body) }),
  deleteTransaction: (id) => request(`/transactions/${id}`, { method: 'DELETE' }),

  getSummary: () => request('/summary'),
   getReminders: () => request('/reminders'),

  getTransactions: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/transactions${qs ? '?' + qs : ''}`);
  },
  reverseTransaction: (id, reason) =>
    request(`/transactions/${id}/reverse`, { method: 'POST', body: JSON.stringify({ reason }) }),
  askCopilot: (message) => request('/copilot', { method: 'POST', body: JSON.stringify({ message }) }),
  
  updateProfile: (shop_name) => request('/settings/profile', { method: 'PUT', body: JSON.stringify({ shop_name }) }),
  changePassword: (body) => request('/settings/password', { method: 'PUT', body: JSON.stringify(body) }),

    updateCustomer: (id, body) => request(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateTransaction: (id, body) => request(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (body) => request('/auth/password', { method: 'PUT', body: JSON.stringify(body) }),
  getMonthly: () => request('/monthly'),

  // Downloads the CSV file (not JSON, so it does not use request())
  downloadExport: async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    let res;
    try {
      res = await fetch(`${BASE_URL}/export`, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      throw new Error('Cannot connect to the server. Please make sure the backend is running.');
    }
    if (!res.ok) throw new Error('Could not export your data. Please try again.');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'digital-khata-export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};

export default api;