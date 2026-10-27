import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { OrgSectionHeaderCard } from './OrgSectionHeaderCard';

jest.mock('@principal-ade/industry-theme', () => ({
  useTheme: () => ({
    theme: {
      colors: { backgroundSecondary: '#123456' },
      fonts: {},
      fontSizes: [10, 12, 14],
    },
  }),
}));

const header = { orgName: 'Owner organization', login: 'owner', repoCount: 2 };

test('can hide owner tooltips without hiding accessible labels', () => {
  const { container } = render(
    <OrgSectionHeaderCard
      header={header}
      showTooltips={false}
      onOpen={jest.fn()}
    />,
  );
  expect(container.querySelector('[title]')).toBeNull();
});

test.each([undefined, true])(
  'uses square edges only when flush=%s',
  (flush) => {
    render(
      <OrgSectionHeaderCard
        header={header}
        flush={flush}
        onToggle={jest.fn()}
      />,
    );
    const row = screen.getByRole('button');
    expect(row.style.borderRadius).toBe(flush ? '0' : '6px');
    expect(row.style.paddingLeft).toBe('10px');
    expect(row.style.paddingTop).toBe(flush ? '12px' : '5px');
    expect(row.style.paddingBottom).toBe(flush ? '10px' : '5px');
    const divider = row.nextElementSibling as HTMLElement;
    expect(divider.style.marginTop).toBe(flush ? '0px' : '5px');
    fireEvent.mouseEnter(row);
    expect(row.style.backgroundColor).toBe('rgb(18, 52, 86)');
    fireEvent.mouseLeave(row);
    expect(row.style.backgroundColor).toBe('transparent');
  },
);

test.each([false, true])(
  'preserves collapsible headers for Projects when collapsed=%s',
  (isCollapsed) => {
    const onToggle = jest.fn();
    const { container } = render(
      <OrgSectionHeaderCard
        header={header}
        isCollapsed={isCollapsed}
        onToggle={onToggle}
      />,
    );
    const button = screen.getByRole('button');
    expect(button.getAttribute('aria-expanded')).toBe(String(!isCollapsed));
    expect(
      container.querySelector(
        isCollapsed ? '.lucide-chevron-right' : '.lucide-chevron-down',
      ),
    ).not.toBeNull();
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  },
);

test('profile headings support click and keyboard navigation without collapse controls', () => {
  const onOpen = jest.fn();
  const { container } = render(
    <OrgSectionHeaderCard header={header} onOpen={onOpen} />,
  );
  const button = screen.getByText(header.orgName).closest('[role="button"]');
  if (!button) throw new Error('Missing owner heading');
  expect(button.getAttribute('tabindex')).toBe('0');
  expect(button.hasAttribute('aria-expanded')).toBe(false);
  expect(container.querySelector('.lucide-chevron-down')).toBeNull();
  expect(container.querySelector('.lucide-chevron-right')).toBeNull();
  fireEvent.click(button);
  fireEvent.keyDown(button, { key: 'Enter' });
  fireEvent.keyDown(button, { key: ' ' });
  expect(onOpen).toHaveBeenCalledTimes(3);
});
