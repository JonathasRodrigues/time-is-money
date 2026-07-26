import React from 'react';
import { Body, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
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
