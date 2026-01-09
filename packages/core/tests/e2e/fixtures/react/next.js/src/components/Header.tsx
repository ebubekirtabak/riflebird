import React from 'react';

export interface HeaderProps {
  title?: string;
}

export const Header: React.FC<HeaderProps> = ({ title = 'Next.js App' }) => {
  return (
    <header className="p-4 bg-gray-100">
      <h1 className="text-2xl font-bold">{title}</h1>
    </header>
  );
};
