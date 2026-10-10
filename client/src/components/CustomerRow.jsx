import { Link } from 'react-router-dom';
import { formatMoney, balanceClass, balanceLabel } from '../services/format.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import RiskBadge from './RiskBadge.jsx';

// One customer in a list. onEntry(customer, 'credit' | 'payment') opens the transaction popup.
export default function CustomerRow({ customer, onEntry }) {
  const { t } = useLanguage();
  return (
    <li className="customer-row">
      <div className="avatar" aria-hidden="true">{customer.name.charAt(0).toUpperCase()}</div>
      <div className="customer-info">
        <div className="customer-name">
          <Link to={`/customers/${customer.id}`}>{customer.name}</Link>
        </div>
        <div className="customer-phone">
          {customer.phone} <RiskBadge risk={customer.risk} />
        </div>
      </div>
      <div className="customer-balance">
        <span className={balanceClass(customer.balance)}>{formatMoney(customer.balance)}</span>
        <small>{balanceLabel(customer.balance)}</small>
      </div>
      <div className="row-actions">
        <Link className="btn btn-secondary btn-sm" to={`/customers/${customer.id}`}>{t('ledger')}</Link>
        <button className="btn btn-secondary btn-sm" onClick={() => onEntry(customer, 'credit')}>{t('youGave')}</button>
        <button className="btn btn-secondary btn-sm" onClick={() => onEntry(customer, 'payment')}>{t('youGot')}</button>
      </div>
    </li>
  );
}