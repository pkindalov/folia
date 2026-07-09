import { toast as toastify, type ToastOptions } from 'react-toastify';
import Icon from '../components/Icon';

const baseOptions: ToastOptions = {
  theme: 'colored',
};

export const toast = {
  success(message: string, options?: ToastOptions) {
    toastify.success(message, {
      ...baseOptions,
      icon: <Icon name="check_circle" filled />,
      ...options,
    });
  },
  error(message: string, options?: ToastOptions) {
    toastify.error(message, {
      ...baseOptions,
      icon: <Icon name="error" filled />,
      ...options,
    });
  },
};
