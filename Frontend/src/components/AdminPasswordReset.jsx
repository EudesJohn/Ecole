import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button, Input, Card, Alert, Space } from 'antd';

const AdminPasswordReset = () => {
  const { user, schoolId } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/reset-own-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          currentPassword,
          newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Échec de la mise à jour du mot de passe');
      }

      setSuccess('Mot de passe mis à jour avec succès !');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card title="Changer le mot de passe administrateur" style={{ maxWidth: 500, margin: '20px auto' }}>
      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      {success && <Alert message={success} type="success" showIcon style={{ marginBottom: 16 }} />}

      <form onSubmit={handleSubmit}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <label htmlFor="currentPassword">Mot de passe actuel</label>
            <Input.Password
              id="currentPassword"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Entrez votre mot de passe actuel"
              required
            />
          </div>

          <div>
            <label htmlFor="newPassword">Nouveau mot de passe</label>
            <Input.Password
              id="newPassword"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Entrez votre nouveau mot de passe"
              required
              minLength={6}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</label>
            <Input.Password
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmez votre nouveau mot de passe"
              required
            />
          </div>

          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            block
          >
            Mettre à jour le mot de passe
          </Button>
        </Space>
      </form>
    </Card>
  );
};

export default AdminPasswordReset;