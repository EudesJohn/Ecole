import { motion } from 'framer-motion';

const SkeletonLoader = ({ type = 'card', count = 1 }) => {
  const items = Array.from({ length: count }, (_, i) => i);

  const CardSkeleton = () => (
    <div className="glass-card p-6 space-y-4 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 skeleton-circle"></div>
        <div className="flex-1 space-y-2">
          <div className="skeleton-text w-3/4"></div>
          <div className="skeleton-text w-1/2 h-3"></div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="skeleton-text"></div>
        <div className="skeleton-text w-5/6"></div>
      </div>
    </div>
  );

  const TableSkeleton = () => (
    <div className="glass-card p-6 space-y-3 animate-pulse">
      <div className="skeleton-text w-1/3 h-6 mb-4"></div>
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex gap-4">
          <div className="skeleton-text w-1/4"></div>
          <div className="skeleton-text w-1/4"></div>
          <div className="skeleton-text w-1/4"></div>
          <div className="skeleton-text w-1/4"></div>
        </div>
      ))}
    </div>
  );

  const TextSkeleton = () => (
    <div className="space-y-2 animate-pulse">
      <div className="skeleton-text w-full"></div>
      <div className="skeleton-text w-4/5"></div>
      <div className="skeleton-text w-3/4"></div>
    </div>
  );

  const StatSkeleton = () => (
    <div className="glass-card p-6 animate-pulse">
      <div className="skeleton-text w-1/2 h-3 mb-3"></div>
      <div className="skeleton-text w-2/3 h-8"></div>
    </div>
  );

  const Component = {
    card: CardSkeleton,
    table: TableSkeleton,
    text: TextSkeleton,
    stat: StatSkeleton,
  }[type] || CardSkeleton;

  return (
    <div className="space-y-4">
      {items.map((i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
        >
          <Component />
        </motion.div>
      ))}
    </div>
  );
};

export default SkeletonLoader;
