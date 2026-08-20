import React, { type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react'

export interface FieldProps {
  label: string
  description?: string
  error?: string
}

export interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement>, FieldProps {
  loading?: boolean
}

export const InputField = React.forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, description, error, loading, className = '', ...props }, ref) => (
    <div className={`bridge-field ${className}`}>
      <label>
        <span className="bridge-field-label">{label}</span>
        {description && <span className="bridge-field-description">{description}</span>}
        <input ref={ref} className="bridge-input" aria-invalid={!!error} {...props} />
      </label>
      {error && <span className="bridge-field-error" role="alert">{error}</span>}
    </div>
  )
)
InputField.displayName = 'InputField'

export interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldProps {}

export const TextareaField = React.forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, description, error, className = '', ...props }, ref) => (
    <div className={`bridge-field ${className}`}>
      <label>
        <span className="bridge-field-label">{label}</span>
        {description && <span className="bridge-field-description">{description}</span>}
        <textarea ref={ref} className="bridge-textarea" aria-invalid={!!error} {...props} />
      </label>
      {error && <span className="bridge-field-error" role="alert">{error}</span>}
    </div>
  )
)
TextareaField.displayName = 'TextareaField'

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement>, FieldProps {}

export const SelectField = React.forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, description, error, children, className = '', ...props }, ref) => (
    <div className={`bridge-field ${className}`}>
      <label>
        <span className="bridge-field-label">{label}</span>
        {description && <span className="bridge-field-description">{description}</span>}
        <select ref={ref} className="bridge-select" aria-invalid={!!error} {...props}>
          {children}
        </select>
      </label>
      {error && <span className="bridge-field-error" role="alert">{error}</span>}
    </div>
  )
)
SelectField.displayName = 'SelectField'

export interface CheckboxFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
}

export const CheckboxField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ label, className = '', ...props }, ref) => (
    <label className={`bridge-checkbox-field ${className}`}>
      <input ref={ref} type="checkbox" className="bridge-checkbox" {...props} />
      <span>{label}</span>
    </label>
  )
)
CheckboxField.displayName = 'CheckboxField'

export const SwitchField = React.forwardRef<HTMLInputElement, CheckboxFieldProps>(
  ({ label, className = '', ...props }, ref) => (
    <label className={`bridge-switch-field ${className}`}>
      <input ref={ref} type="checkbox" role="switch" className="bridge-switch" {...props} />
      <span>{label}</span>
    </label>
  )
)
SwitchField.displayName = 'SwitchField'
