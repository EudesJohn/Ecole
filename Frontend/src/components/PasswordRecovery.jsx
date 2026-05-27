import React, { useState } from 'react';
import { Button, Input, Card, Alert, Space, Typography } from 'antd';

const { Text } = Typography;

const PasswordRecovery = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email || !email.includes('@')) {
      setError('Veuillez entrer une adresse email valide');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/recover-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Échec de l\'envoi de l\'email de récupération');
      }

      setSuccess('Si cette adresse email existe dans notre système, un lien de récupération a été envoyé.');
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card title="Récupération de mot de passe" style={{ maxWidth: 500, margin: '20px auto' }}>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
      </Text>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
      {success && <Alert message={success} type="success" showIcon style={{ marginBottom: 16 }} />}

      <form onSubmit={handleSubmit}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <label htmlFor="email">Adresse Email</label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Entrez votre adresse email"
              required
            />
          </div>

          <Button
            type="primary"
            htmlType="submit"
            loading={isLoading}
            block
          >
            Envoyer le lien de récupération
          </Button>
        </Space>
      </form>
    </Card>
  );
};

export default PasswordRecovery;