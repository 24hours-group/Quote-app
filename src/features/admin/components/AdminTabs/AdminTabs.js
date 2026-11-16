import { Truck, PhoneCall, DollarSign, Bell, Users, Building2 } from 'lucide-react';
import styles from './AdminTabs.module.css';

export function AdminTabs({ activeTab, onChangeTab, counts = {}, currentRole }) {
  const isSuperAdmin = currentRole === 'super_admin';

  const tabs = [
    {
      id: 'bookings',
      label: 'Bookings & Dispatch',
      icon: Truck,
      count: counts.bookingsCount,
    },
    {
      id: 'callbacks',
      label: 'Callback Leads',
      icon: PhoneCall,
      count: counts.callbacksCount,
    },
    {
      id: 'pricing',
      label: 'Rates & Pricing',
      icon: DollarSign,
    },
    {
      id: 'notifications',
      label: 'Email Logs',
      icon: Bell,
      count: counts.failedCount ? `${counts.failedCount} failed` : null,
    },
    ...(isSuperAdmin
      ? [
          {
            id: 'team',
            label: 'Admin Team',
            icon: Users,
          },
          {
            id: 'company',
            label: 'Company Settings',
            icon: Building2,
          },
        ]
      : []),
  ];

  return (
    <nav className={styles.tabBar} aria-label="Admin Navigation Tabs">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        const buttonClass = isActive
          ? `${styles.tabButton} ${styles.tabButtonActive}`
          : styles.tabButton;
        const badgeClass = isActive
          ? `${styles.tabBadge} ${styles.tabBadgeActive}`
          : styles.tabBadge;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={buttonClass}
          >
            <Icon size={15} />
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count !== null ? (
              <span className={badgeClass}>{tab.count}</span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}

