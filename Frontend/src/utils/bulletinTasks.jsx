import { pdf } from '@react-pdf/renderer';
import SecureBulletin from '../components/SecureBulletin';

// Helper to generate QR data URL
export const generateQRDataUrl = async (text) => {
  try {
    const QRCode = await import('qrcode');
    // Handle both default and named exports
    const lib = QRCode.toDataURL ? QRCode : (QRCode.default || QRCode);
    const toDataURL = lib.toDataURL;
    
    if (!toDataURL) return null;

    return await toDataURL(text, {
      width: 120,
      margin: 1,
      color: { dark: '#1e3a8a', light: '#ffffff' },
    });
  } catch (err) {
    console.error('QR Error:', err);
    return null;
  }
};

// Helper to trigger PDF download
// props must include: student, gradesBySubject, matieres, classStats, qrCodeDataUrl, trimestre, schoolYear, schoolInfo (optional)
export const downloadBulletin = async (props) => {
  const blob = await pdf(<SecureBulletin {...props} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Bulletin_${props.student.matricule}_T${props.trimestre || '1'}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
};
