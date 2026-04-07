import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white shadow-lg hover:shadow-xl',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-700 shadow-sm hover:shadow-md',
  danger: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg',
  gold: 'bg-gradient-to-r from-gold-500 to-gold-600 hover:from-gold-600 hover:to-gold-700 text-white shadow-gold',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-600',
  outline: 'bg-transparent border-2 border-primary-500 text-primary-500 hover:bg-primary-50',
};

const sizes = {
  sm: 'py-2 px-3 text-xs rounded-lg',
  md: 'py-2.5 px-5 text-sm rounded-xl',
  lg: 'py-3.5 px-6 text-base rounded-xl',
  xl: 'py-4 px-8 text-lg rounded-2xl',
};

export const Button = ({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon: Icon,
  className = '',
  ...props
}) => {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.01 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2 font-semibold
        transition-all duration-300 transform
        disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
        ${variants[variant]}
        ${sizes[size]}
        ${className}
      `}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : Icon ? (
        <Icon size={size === 'sm' ? 14 : size === 'xl' ? 20 : 16} />
      ) : null}
      {children}
    </motion.button>
  );
};

export default Button;
