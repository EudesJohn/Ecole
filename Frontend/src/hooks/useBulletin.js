import { useState } from 'react';
import { supabase } from '../supabase';
import { generateQRDataUrl, downloadBulletin } from '../utils/bulletinTasks';
import { useSchool } from '../contexts/SchoolContext';

export const useBulletin = () => {
  const [generatingPdf, setGeneratingPdf] = useState(null);
  const { school } = useSchool();

  const handleGenerateBulletin = async (student, schoolConfig, classes, matieres, periodLabel = null) => {
    setGeneratingPdf(student.id);
    try {
      if (!student.classe_id) throw new Error("Cet élève n'est pas assigné à une classe.");

      // 1. Fetch Detailed Stats via RPC
      const { data: statsData, error: rpcError } = await supabase.rpc('get_detailed_stats', {
        p_student_id: student.id,
        p_trimestre: parseInt(schoolConfig.current_trimestre),
        p_school_year: schoolConfig.current_year,
        p_period_label: periodLabel
      });
      if (rpcError) throw rpcError;

      const classStats = {
        effectif: statsData?.general_stats?.effectif || 0,
        plusForte: statsData?.general_stats?.max_moyenne || 0,
        plusFaible: statsData?.general_stats?.min_moyenne || 0,
        studentAverage: statsData?.general_stats?.moyenne_generale || 0,
        rang: statsData?.general_stats?.rang || 1,
        subjectStats: statsData?.subject_stats || []
      };

      // 2. Fetch specific grades for target student
      const query = supabase
        .from('grades')
        .select('*, matieres(nom, coefficient)')
        .eq('student_id', student.id)
        .eq('school_year', schoolConfig.current_year)
        .eq('evaluation_type', 'composition');

      if (periodLabel) {
        query.eq('period_label', periodLabel);
      } else {
        query.eq('trimestre', parseInt(schoolConfig.current_trimestre));
      }

      const { data: studentGrades, error: gradesError } = await query;

      if (gradesError) throw gradesError;
      if (!studentGrades || studentGrades.length === 0) {
        throw new Error("Cet élève n'a aucune note.");
      }

      // 3. Prepare grades by subject
      // Grouping by matiere_id because primary cycle can have multiple records per subject
      const gradesByMatiere = studentGrades.reduce((acc, g) => {
        if (!acc[g.matiere_id]) acc[g.matiere_id] = [];
        acc[g.matiere_id].push(g);
        return acc;
      }, {});

      const targetGrades = Object.keys(gradesByMatiere).map(matiereId => {
        const subjectGrades = gradesByMatiere[matiereId];
        const first = subjectGrades[0];
        const sStat = (classStats.subjectStats || []).find(ss => String(ss.matiere_id) === String(matiereId)) || {};

        return {
          matiere: first.matieres?.nom,
          matiere_id: matiereId,
          coefficient: first.matieres?.coefficient || 1,
          grades: subjectGrades, // All records for this subject
          // For compatibility with PDF component
          interro1: first.interro1,
          interro2: first.interro2,
          interro3: first.interro3,
          dw: first.dw,
          d1: first.d1,
          d2: first.d2,
          note_cm: first.note_cm,
          note_cp: first.note_cp,
          composition: first.composition,
          note_orale: first.note_orale,
          note_pratique: first.note_pratique,
          max: sStat.max || 0,
          min: sStat.min || 0
        };
      });

      // 4. Generate QR code using generic domain
      const qrText = `https://erp-ecole.bj/verify/${student.matricule}/${schoolConfig.current_trimestre}/${schoolConfig.current_year}${periodLabel ? `?p=${encodeURIComponent(periodLabel)}` : ''}`;
      const qrUrl = await generateQRDataUrl(qrText);

      // 5. Download Bulletin
      const studentClass = classes.find(c => c.id === student.classe_id);

      await downloadBulletin({
        student: {
          ...student,
          classe: studentClass?.nom || 'N/A',
          cycle: studentClass?.cycle || 'primaire',
          dateNaissance: student.date_naissance,
          sexe: student.sexe || '—'
        },
        gradesBySubject: targetGrades,
        matieres,
        classStats,
        qrCodeDataUrl: qrUrl,
        trimestre: periodLabel || `${schoolConfig.current_trimestre}${schoolConfig.current_trimestre === '1' ? 'er' : 'ème'}`,
        schoolYear: schoolConfig.current_year,
        periodLabel: periodLabel,
        schoolInfo: school
      });

      return true;
    } catch (err) {
      console.error('PDF Generation Error:', err);
      throw err;
    } finally {
      setGeneratingPdf(null);
    }
  };

  return { handleGenerateBulletin, generatingPdf };
};
