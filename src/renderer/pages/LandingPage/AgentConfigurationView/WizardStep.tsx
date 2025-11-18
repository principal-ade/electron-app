import { useTheme } from '@principal-ade/industry-theme';

interface WizardStepProps {
  icon: React.ReactNode;
  title: string;
  titleColor?: string;
  description: string;
  children?: React.ReactNode;
  iconBackgroundColor?: string;
  dataTour?: string;
}

export const WizardStep: React.FC<WizardStepProps> = ({
  icon,
  title,
  titleColor,
  description,
  children,
  iconBackgroundColor,
  dataTour,
}) => {
  const { theme } = useTheme();

  return (
    <div className="text-center" data-tour={dataTour}>
      <div className="mb-6">
        <div
          className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
          style={{
            backgroundColor:
              iconBackgroundColor || theme.colors.backgroundSecondary,
          }}
        >
          {icon}
        </div>
        <h3
          className="text-xl font-semibold mb-2"
          style={{ color: titleColor || theme.colors.text }}
        >
          {title}
        </h3>
        <p style={{ color: theme.colors.textSecondary, height: '48px' }}>
          {description}
        </p>
      </div>
      <div
        style={{
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
};
