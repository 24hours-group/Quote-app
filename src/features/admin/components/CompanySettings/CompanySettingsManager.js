'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  PhoneCall,
  Mail,
  Clock,
  MessageSquare,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  COMMON_TIMEZONES,
  DEFAULT_COMPANY_MESSAGES,
} from '@/features/admin/constants/companySettings';
import styles from './CompanySettingsManager.module.css';

export function CompanySettingsManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  const [companyName, setCompanyName] = useState('');
  const [supportPhone, setSupportPhone] = useState('');
  const [dispatchEmail, setDispatchEmail] = useState('');
  const [defaultTimezone, setDefaultTimezone] = useState('America/New_York');
  const [manualReviewMsg, setManualReviewMsg] = useState(
    DEFAULT_COMPANY_MESSAGES.manual_review,
  );
  const [quoteExpiredMsg, setQuoteExpiredMsg] = useState(
    DEFAULT_COMPANY_MESSAGES.quote_expired,
  );
  const [paymentPendingMsg, setPaymentPendingMsg] = useState(
    DEFAULT_COMPANY_MESSAGES.payment_pending,
  );
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/company');
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load company settings');
      }

      const data = json.data;
      setCompanyName(data.company_name || '');
      setSupportPhone(data.support_phone_e164 || '');
      setDispatchEmail(data.dispatch_email || '');
      setDefaultTimezone(data.default_timezone || 'America/New_York');
      setUpdatedAt(data.updated_at || null);

      if (data.messages) {
        if (data.messages.manual_review) {
          setManualReviewMsg(data.messages.manual_review);
        }
        if (data.messages.quote_expired) {
          setQuoteExpiredMsg(data.messages.quote_expired);
        }
        if (data.messages.payment_pending) {
          setPaymentPendingMsg(data.messages.payment_pending);
        }
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setFeedback(null);
    setFieldErrors({});

    const payload = {
      company_name: companyName,
      support_phone: supportPhone,
      dispatch_email: dispatchEmail,
      default_timezone: defaultTimezone,
      messages: {
        manual_review: manualReviewMsg,
        quote_expired: quoteExpiredMsg,
        payment_pending: paymentPendingMsg,
      },
    };

    try {
      const res = await fetch('/api/admin/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: payload }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.fieldErrors) {
          setFieldErrors(json.fieldErrors);
        }
        throw new Error(json.error || 'Failed to save company settings');
      }

      setFeedback({
        type: 'success',
        message: 'Company settings updated successfully! Live dispatch and notifications will use these details.',
      });
      setUpdatedAt(json.data.updated_at || new Date().toISOString());
      if (json.data.support_phone_e164) {
        setSupportPhone(json.data.support_phone_e164);
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        Loading company settings…
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={styles.container}>
      <div className={styles.headerCard}>
        <div className={styles.headerInfo}>
          <div className={styles.headerIconWrapper}>
            <Building2 size={20} />
          </div>
          <div>
            <div className={styles.headerTitle}>
              Company & Operational Settings
            </div>
            <div className={styles.headerDesc}>
              Configure legal operating identity, customer support hotline,
              dispatch notification email, and default timezone.
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className={styles.saveButton}
        >
          {saving ? (
            <RefreshCw size={14} className={styles.saveSpinner} />
          ) : (
            <Save size={14} />
          )}
          {saving ? 'Saving Settings…' : 'Save Company Settings'}
        </button>
      </div>

      {feedback ? (
        <div
          className={
            feedback.type === 'success'
              ? styles.feedbackSuccess
              : styles.feedbackError
          }
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{feedback.message}</span>
        </div>
      ) : null}

      <div className={styles.sectionsGrid}>
        {/* Contact & Dispatch Information */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <Building2 size={16} className={styles.sectionIcon} />
            <span>Company Identity & Dispatch Routing</span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="companyName">
              Operating Company Name *
            </label>
            <input
              id="companyName"
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Townexa Towing & Roadside"
              required
              className={styles.textInput}
            />
            {fieldErrors.company_name ? (
              <span className={styles.fieldError}>
                {fieldErrors.company_name}
              </span>
            ) : (
              <span className={styles.fieldHint}>
                Customer-facing business name displayed on booking confirmation
                and invoices.
              </span>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="supportPhone">
              Customer Support Hotline (E.164) *
            </label>
            <div className={styles.fieldGroup}>
              <input
                id="supportPhone"
                type="tel"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="+1 800-555-0142"
                required
                className={styles.textInput}
              />
            </div>
            {fieldErrors.support_phone ? (
              <span className={styles.fieldError}>
                {fieldErrors.support_phone}
              </span>
            ) : (
              <span className={styles.fieldHint}>
                Phone number customers see to request assistance or callbacks
                (e.g., (800) 555-0142).
              </span>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="dispatchEmail">
              Dispatch Notification Email *
            </label>
            <input
              id="dispatchEmail"
              type="email"
              value={dispatchEmail}
              onChange={(e) => setDispatchEmail(e.target.value)}
              placeholder="dispatch@example.com"
              required
              className={styles.textInput}
            />
            {fieldErrors.dispatch_email ? (
              <span className={styles.fieldError}>
                {fieldErrors.dispatch_email}
              </span>
            ) : (
              <span className={styles.fieldHint}>
                Primary email destination where newly booked tow orders and
                payment confirmations are routed.
              </span>
            )}
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="defaultTimezone">
              Default Operational Timezone *
            </label>
            <select
              id="defaultTimezone"
              value={defaultTimezone}
              onChange={(e) => setDefaultTimezone(e.target.value)}
              className={styles.selectInput}
            >
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label} ({tz.value})
                </option>
              ))}
            </select>
            {fieldErrors.default_timezone ? (
              <span className={styles.fieldError}>
                {fieldErrors.default_timezone}
              </span>
            ) : (
              <span className={styles.fieldHint}>
                Used for day/night schedule pricing calculations and operational
                timestamps.
              </span>
            )}
          </div>
        </div>

        {/* Operational Messages */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <MessageSquare size={16} className={styles.sectionIcon} />
            <span>Customer Operational Notices</span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="manualReviewMsg">
              Manual Review Required Message
            </label>
            <textarea
              id="manualReviewMsg"
              rows={3}
              value={manualReviewMsg}
              onChange={(e) => setManualReviewMsg(e.target.value)}
              className={styles.textareaInput}
            />
            <span className={styles.fieldHint}>
              Shown to customers when abnormal conditions require dispatcher
              review before instant pricing.
            </span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="quoteExpiredMsg">
              Quote Expired Notice
            </label>
            <textarea
              id="quoteExpiredMsg"
              rows={3}
              value={quoteExpiredMsg}
              onChange={(e) => setQuoteExpiredMsg(e.target.value)}
              className={styles.textareaInput}
            />
            <span className={styles.fieldHint}>
              Notice displayed when a price quote has lapsed past the guarantee
              window.
            </span>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="paymentPendingMsg">
              Payment Pending Confirmation Message
            </label>
            <textarea
              id="paymentPendingMsg"
              rows={3}
              value={paymentPendingMsg}
              onChange={(e) => setPaymentPendingMsg(e.target.value)}
              className={styles.textareaInput}
            />
            <span className={styles.fieldHint}>
              Notice displayed on the checkout receipt page while waiting for
              Stripe confirmation.
            </span>
          </div>
        </div>
      </div>

      {updatedAt ? (
        <div className={styles.footerMeta}>
          <span>Scope: default</span>
          <span>Last updated: {new Date(updatedAt).toLocaleString()}</span>
        </div>
      ) : null}
    </form>
  );
}

