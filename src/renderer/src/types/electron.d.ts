interface Window {
  electron: {
    // ... 其他已有的类型 ...
    window: {
      blur: () => void;
      focus: () => void;
      hide: () => void;
      show: () => void;
      close: () => void;
    };
  };
} 