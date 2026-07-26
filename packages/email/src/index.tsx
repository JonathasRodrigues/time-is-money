import React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components';
import { Resend } from 'resend';

export interface DueReminderItem {
  name: string;
  dueOn: string;
  amountLabel: string;
  daysLeft: number;
}

function formatIsoDateBr(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function DueReminderEmail(props: {
  userName: string;
  items: DueReminderItem[];
}): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>Lembretes de vencimento — Time is Money</Preview>
      <Body
        style={{
          fontFamily: 'IBM Plex Sans, Helvetica, Arial, sans-serif',
          background: '#eef2ef',
          color: '#15201b',
        }}
      >
        <Container style={{ padding: '24px', background: '#f8faf8', borderRadius: 8 }}>
          <Heading style={{ fontSize: 22 }}>Olá, {props.userName}</Heading>
          <Text>Estes vencimentos estão próximos:</Text>
          {props.items.map((item) => (
            <Text key={`${item.name}-${item.dueOn}`}>
              • {item.name} — {item.amountLabel} em {formatIsoDateBr(item.dueOn)} (D-
              {item.daysLeft})
            </Text>
          ))}
          <Text style={{ color: '#5a675f', fontSize: 12 }}>
            Time is Money — você pode ajustar alertas nas preferências do app.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function HouseholdInviteEmail(props: {
  inviterName: string;
  householdName: string;
  roleLabel: string;
  inviteUrl: string;
}): React.ReactElement {
  return (
    <Html>
      <Head />
      <Preview>Convite para {props.householdName} — Time is Money</Preview>
      <Body
        style={{
          fontFamily: 'IBM Plex Sans, Helvetica, Arial, sans-serif',
          background: '#eef2ef',
          color: '#15201b',
        }}
      >
        <Container style={{ padding: '24px', background: '#f8faf8', borderRadius: 8 }}>
          <Heading style={{ fontSize: 22 }}>Você foi convidado</Heading>
          <Text>
            {props.inviterName} convidou você para o household{' '}
            <strong>{props.householdName}</strong> como {props.roleLabel}.
          </Text>
          <Text>Crie ou entre na sua conta com este e-mail e aceite o convite:</Text>
          <Button
            href={props.inviteUrl}
            style={{
              background: '#155e4f',
              color: '#ffffff',
              padding: '12px 18px',
              borderRadius: 6,
              textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Aceitar convite
          </Button>
          <Text style={{ color: '#5a675f', fontSize: 12, marginTop: 24 }}>
            Se você não esperava este e-mail, pode ignorá-lo. O link expira em 7 dias.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function createResendClient(apiKey: string): Resend {
  return new Resend(apiKey);
}

export async function sendDueReminderEmail(input: {
  apiKey: string;
  from: string;
  to: string;
  userName: string;
  items: DueReminderItem[];
}): Promise<{ id?: string }> {
  const resend = createResendClient(input.apiKey);
  const result = await resend.emails.send({
    from: input.from,
    to: input.to,
    subject: `Vencimentos próximos (${input.items.length})`,
    react: DueReminderEmail({ userName: input.userName, items: input.items }),
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return { id: result.data?.id };
}

export async function sendHouseholdInviteEmail(input: {
  apiKey: string;
  from: string;
  to: string;
  inviterName: string;
  householdName: string;
  roleLabel: string;
  inviteUrl: string;
}): Promise<{ id?: string }> {
  const resend = createResendClient(input.apiKey);
  const result = await resend.emails.send({
    from: input.from,
    to: input.to,
    subject: `Convite para ${input.householdName} — Time is Money`,
    react: HouseholdInviteEmail({
      inviterName: input.inviterName,
      householdName: input.householdName,
      roleLabel: input.roleLabel,
      inviteUrl: input.inviteUrl,
    }),
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return { id: result.data?.id };
}
