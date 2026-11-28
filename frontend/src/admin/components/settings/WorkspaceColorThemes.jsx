import { useId } from 'react';
import { Check } from 'lucide-react';
import { STUDIO_COLOR_THEMES } from '../../../utils/studioColorThemes';
import './WorkspaceColorThemes.css';

export default function WorkspaceColorThemes({ current, onChange }) {
  const name = useId();

  return (
    <fieldset className="settings-color-themes">
      <legend>Color theme</legend>
      <p>Choose a palette for your workspace. It works in daylight and dark mode.</p>
      <div className="settings-color-grid">
        {STUDIO_COLOR_THEMES.map(({ value, label, description }) => (
          <label className="settings-color-option" data-studio-palette-preview={value} key={value}>
            <input
              type="radio"
              name={name}
              value={value}
              checked={current === value}
              onChange={() => onChange(value)}
              aria-label={label}
              aria-describedby={name + '-' + value}
            />
            <span className="settings-color-sample" aria-hidden="true">
              <span className="settings-color-sample-selection" />
              <span className="settings-color-sample-content">
                <span className="settings-color-sample-line" />
                <span className="settings-color-sample-action" />
              </span>
            </span>
            <span className="settings-color-caption">
              <strong>{label}</strong>
              {current === value && <Check size={16} aria-hidden="true" />}
            </span>
            <small id={name + '-' + value}>{description}</small>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
