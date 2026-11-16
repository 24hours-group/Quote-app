import styles from './SurfaceCard.module.css';

export function SurfaceCard({ children, className = '', ...props }) {
  const cardClassName = className ? `${styles.card} ${className}` : styles.card;
  return (
    <div className={cardClassName} {...props}>
      {children}
    </div>
  );
}
