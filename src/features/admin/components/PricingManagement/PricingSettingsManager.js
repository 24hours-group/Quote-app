'use client';

import { useState, useEffect } from 'react';
import { Truck, Wrench, Clock, Save, RefreshCw } from 'lucide-react';
import styles from './PricingSettingsManager.module.css';

export function PricingSettingsManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(null);
  const [formValues, setFormValues] = useState({});
  const [items, setItems] = useState([]);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    loadPricing();
  }, []);

  async function loadPricing() {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/pricing');
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to load pricing');
      }
      setVersion(data.data.version);
      setItems(data.data.items);

      // Initialize form values in human readable units (dollars for cents)
      const initial = {};
      data.data.items.forEach((item) => {
        if (item.unit === 'cents' || item.unit === 'cents_per_mile') {
          initial[item.key] = (item.value / 100).toFixed(2);
        } else {
          initial[item.key] = item.value;
        }
      });
      setFormValues(initial);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setLoading(false);
    }
  }

  function handleInputChange(key, val) {
    setFormValues((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSave(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFeedback(null);

    try {
      // Convert values back to database format (cents for money)
      const updates = {};
      items.forEach((item) => {
        const val = formValues[item.key];
        if (item.unit === 'cents' || item.unit === 'cents_per_mile') {
          updates[item.key] = Math.round(parseFloat(val || 0) * 100);
        } else {
          updates[item.key] = Math.round(parseFloat(val || 0));
        }
      });

      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save pricing configuration');
      }

      setFeedback({
        type: 'success',
        message: `Pricing successfully updated! Version ${data.data.version} is now active across all quotes.`,
      });
      setVersion(data.data.version);
    } catch (err) {
      setFeedback({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  }

  const towingItems = items.filter((i) => i.category === 'towing');
  const roadsideItems = items.filter((i) => i.category === 'roadside');
  const scheduleItems = items.filter((i) => i.category === 'schedule');

  if (loading) {
    return (
      <div className="p-8 text-center text-sm font-semibold text-slate-500">
        Loading pricing parameters…
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className={styles.container}>
      <div className={styles.headerCard}>
        <div>
          <div className={styles.headerTitle}>
            Live Rate & Pricing Configuration
          </div>
          <div className={styles.headerDesc}>
            Version {version} active. Adjust baseline towing rates, roadside flat
            fees, and day/night schedule boundaries.
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className={styles.saveButton}
        >
          {saving ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Save size={14} />
          )}
          {saving ? 'Publishing Changes…' : 'Save & Publish Rates'}
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
          {feedback.message}
        </div>
      ) : null}

      <div className={styles.cardsGrid}>
        {/* Towing Rates */}
        <div className={styles.categoryCard}>
          <div className={styles.categoryTitle}>
            <Truck size={16} /> Towing Rates & Mileage
          </div>
          <div className={styles.fieldsList}>
            {towingItems.map((item) => (
              <div key={item.key} className={styles.fieldRow}>
                <div className={styles.fieldMeta}>
                  <div className={styles.fieldLabel}>{item.label}</div>
                  <div className={styles.fieldDesc}>{item.description}</div>
                </div>
                <div className={styles.inputGroup}>
                  <input
                    type="number"
                    step="any"
                    value={formValues[item.key] ?? ''}
                    onChange={(e) =>
                      handleInputChange(item.key, e.target.value)
                    }
                    className={styles.inputField}
                    required
                  />
                  <span className={styles.unitLabel}>{item.displayUnit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Roadside Services */}
        <div className={styles.categoryCard}>
          <div className={styles.categoryTitle}>
            <Wrench size={16} /> Roadside Assistance Flat Rates
          </div>
          <div className={styles.fieldsList}>
            {roadsideItems.map((item) => (
              <div key={item.key} className={styles.fieldRow}>
                <div className={styles.fieldMeta}>
                  <div className={styles.fieldLabel}>{item.label}</div>
                  <div className={styles.fieldDesc}>{item.description}</div>
                </div>
                <div className={styles.inputGroup}>
                  <input
                    type="number"
                    step="any"
                    value={formValues[item.key] ?? ''}
                    onChange={(e) =>
                      handleInputChange(item.key, e.target.value)
                    }
                    className={styles.inputField}
                    required
                  />
                  <span className={styles.unitLabel}>{item.displayUnit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operating Schedule */}
        <div className={styles.categoryCard}>
          <div className={styles.categoryTitle}>
            <Clock size={16} /> Schedule & Quote Validity
          </div>
          <div className={styles.fieldsList}>
            {scheduleItems.map((item) => (
              <div key={item.key} className={styles.fieldRow}>
                <div className={styles.fieldMeta}>
                  <div className={styles.fieldLabel}>{item.label}</div>
                  <div className={styles.fieldDesc}>{item.description}</div>
                </div>
                <div className={styles.inputGroup}>
                  <input
                    type="number"
                    step="any"
                    value={formValues[item.key] ?? ''}
                    onChange={(e) =>
                      handleInputChange(item.key, e.target.value)
                    }
                    className={styles.inputField}
                    required
                  />
                  <span className={styles.unitLabel}>{item.displayUnit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}

