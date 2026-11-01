import { useState } from 'react';

/**
 * Tracks which required fields of a form are empty.
 *
 * `validateInputs(frm)` marks every empty field of `frm` as an error and
 * returns true when there is none; `setRemoveError(name)` clears one as the
 * user fixes it.
 */
const useValidateInputs = () => {
  const [inputErrors, setInputErrors] = useState<Record<string, boolean>>({});

  const validateInputs = (frm: Record<string, unknown>) => {
    const errors: Record<string, boolean> = {};
    for (const [field, value] of Object.entries(frm)) {
      if ((typeof value === 'string' && !value.trim()) || !value) errors[field] = true;
    }
    setInputErrors(errors);
    return !Object.keys(errors).length;
  };

  const setRemoveError = (name: string) => setInputErrors(({ [name]: _, ...rest }) => rest);

  return { inputErrors, setInputErrors, setRemoveError, validateInputs };
};

export default useValidateInputs;
