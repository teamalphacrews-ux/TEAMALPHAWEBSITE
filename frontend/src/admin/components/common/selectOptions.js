import { Children, isValidElement, Fragment } from 'react';
const text = node => Array.isArray(node) ? node.map(text).join('') : typeof node === 'string' || typeof node === 'number' ? String(node) : isValidElement(node) ? Children.toArray(node.props.children).map(text).join('') : '';
export function selectOptions(children, group = '', groupDisabled = false) {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement(child)) return [];
    if (child.type === Fragment) return selectOptions(child.props.children, group, groupDisabled);
    if (child.type === 'optgroup') return selectOptions(child.props.children, String(child.props.label || ''), groupDisabled || child.props.disabled);
    if (child.type !== 'option') return [];
    const label = text(child.props.children);
    return [{ value: String(child.props.value ?? label), label, group, disabled: Boolean(groupDisabled || child.props.disabled) }];
  });
}
