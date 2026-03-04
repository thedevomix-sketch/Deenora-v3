import React from 'react';
import { Institution, Language, UserRole } from 'types';
import { ResultEngineProvider, useResultEngine } from 'components/results/ResultEngineProvider';
import SchoolFinalResults from 'components/results/engines/school/FinalResults';
import BefaqFinalResults from 'components/results/engines/befaq/FinalResults';
import QawmiFinalResults from 'components/results/engines/qawmi/FinalResults';

interface FinalResultsProps {
  lang: Language;
  madrasah: Institution | null;
  onBack: () => void;
  role: UserRole;
}

const FinalResultsContent: React.FC<FinalResultsProps> = (props) => {
  const { engine } = useResultEngine();

  switch (engine) {
    case 'befaq':
      return <BefaqFinalResults {...props} />;
    case 'qawmi_custom':
      return <QawmiFinalResults {...props} />;
    case 'school':
    default:
      return <SchoolFinalResults {...props} />;
  }
};

const FinalResults: React.FC<FinalResultsProps> = (props) => {
  if (!props.madrasah) return null;

  return (
    <ResultEngineProvider institution={props.madrasah}>
      <FinalResultsContent {...props} />
    </ResultEngineProvider>
  );
};

export default FinalResults;
