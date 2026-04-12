import React, { useState } from 'react';
import { formatDate } from '../utils/format';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  className?: string;
}

/**
 * A custom date input that displays the date in a user-friendly format (Day Month Year)
 * but uses a native date picker for selection.
 */
const DateInput: React.FC<DateInputProps> = ({ value, onChange, required, className }) => {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <input
        type="date"
        required={required}
        className={className}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setIsEditing(false)}
        autoFocus
      />
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        readOnly
        className={`${className} cursor-pointer`}
        value={formatDate(value)}
        onClick={() => setIsEditing(true)}
        onFocus={() => setIsEditing(true)}
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none opacity-40">
        📅
      </div>
    </div>
  );
};

export default DateInput;
