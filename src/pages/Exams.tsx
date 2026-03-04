
import React from 'react';
import { Institution, Language, UserRole } from 'types';
import { ResultEngineProvider, useResultEngine } from 'components/results/ResultEngineProvider';
import SchoolResultEngine from 'components/results/engines/school/SchoolResultEngine';
import BefaqResultEngine from 'components/results/engines/befaq/BefaqResultEngine';
import QawmiResultEngine from 'components/results/engines/qawmi/QawmiResultEngine';

interface ExamsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
  onNavigateToFinalResults?: () => void;
}

const ExamsContent: React.FC<ExamsProps> = (props) => {
  const { engine } = useResultEngine();

  switch (engine) {
    case 'befaq':
      return <BefaqResultEngine {...props} />;
    case 'qawmi_custom':
      return <QawmiResultEngine {...props} />;
    case 'school':
    default:
      return <SchoolResultEngine {...props} />;
  }
};

const Exams: React.FC<ExamsProps> = (props) => {
  if (!props.madrasah) return null;

  return (
    <ResultEngineProvider institution={props.madrasah}>
      <ExamsContent {...props} />
    </ResultEngineProvider>
  );
};

export default Exams;
