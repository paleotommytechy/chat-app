import { useState, useEffect } from 'react';

export const useReactiveValue = (initialValue) => {
  const [value, setValue] = useState(initialValue);

  const setReactive = (newValue) => {
    setValue(prev => typeof newValue === 'function' ? newValue(prev) : newValue);
  };

  return [value, setReactive];
};