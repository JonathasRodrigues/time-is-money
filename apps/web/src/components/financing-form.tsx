'use client';

import {
  buildAmortizationSchedule,
  formatBrlFromCents,
  formatIsoDateBr,
  type AmortizationSummary,
  type AmortizationSystem,
} from '@tim/domain';
import { useMemo, useState } from 'react';
import { CheckCircle2, Calculator } from 'lucide-react';
import { createFinancingAction } from '@/server/actions';
import { nativeSelectClassName } from '@/components/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Option {
  id: string;
  name: string;
}

interface FinancingFormProps {
  centers: Option[];
  accounts: Option[];
  defaultCostCenterId?: string;
}

function parseMoneyToCents(raw: string): number | null {
  const value = Number(raw.replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

const SYSTEM_HELP: Record<AmortizationSystem, string> = {
  price: 'Parcelas iguais — padrão de veículos e crédito pessoal.',
  sac: 'Parcelas decrescentes — padrão típico de imóvel.',
  fixed: 'Usa o valor de parcela que você informar no contrato.',
};

function ScheduleTable({
  schedule,
}: {
  schedule: AmortizationSummary['schedule'];
}): React.ReactElement {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead className="text-right">Parcela</TableHead>
          <TableHead className="text-right">Juros</TableHead>
          <TableHead className="text-right">Amortização</TableHead>
          <TableHead className="text-right">Saldo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedule.map((row) => (
          <TableRow key={row.number}>
            <TableCell className="tabular-nums font-medium">{row.number}</TableCell>
            <TableCell className="tabular-nums">{formatIsoDateBr(row.dueOn)}</TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {formatBrlFromCents(row.amountCents)}
            </TableCell>
            <TableCell className="text-right tabular-nums text-muted-foreground">
              {formatBrlFromCents(row.interestCents)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatBrlFromCents(row.principalCents)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {formatBrlFromCents(row.balanceAfterCents)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function FinancingForm({
  centers,
  accounts,
  defaultCostCenterId,
}: FinancingFormProps): React.ReactElement {
  const [system, setSystem] = useState<AmortizationSystem>('price');
  const [principal, setPrincipal] = useState('80000');
  const [count, setCount] = useState('48');
  const [rateAa, setRateAa] = useState('12.5');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [firstDueOn, setFirstDueOn] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [showCompare, setShowCompare] = useState(false);

  const simulation: AmortizationSummary | null = useMemo(() => {
    const principalCents = parseMoneyToCents(principal);
    const installmentCount = Number(count);
    if (!principalCents || !Number.isInteger(installmentCount) || installmentCount < 1) {
      return null;
    }
    if (!firstDueOn) return null;

    try {
      if (system === 'fixed') {
        const amountCents = parseMoneyToCents(installmentAmount);
        if (!amountCents) return null;
        return buildAmortizationSchedule({
          system: 'fixed',
          principalCents,
          installmentCount,
          firstDueOn,
          installmentAmountCents: amountCents,
        });
      }
      const annualRate = Number(rateAa.replace(',', '.'));
      if (!Number.isFinite(annualRate) || annualRate < 0) return null;
      return buildAmortizationSchedule({
        system,
        principalCents,
        installmentCount,
        firstDueOn,
        annualRateBps: Math.round(annualRate * 100),
      });
    } catch {
      return null;
    }
  }, [system, principal, count, rateAa, installmentAmount, firstDueOn]);

  const compare = useMemo(() => {
    if (!showCompare || system === 'fixed' || !firstDueOn) return null;
    const principalCents = parseMoneyToCents(principal);
    const installmentCount = Number(count);
    const annualRate = Number(rateAa.replace(',', '.'));
    if (!principalCents || !Number.isInteger(installmentCount) || !Number.isFinite(annualRate)) {
      return null;
    }
    const annualRateBps = Math.round(annualRate * 100);
    const price = buildAmortizationSchedule({
      system: 'price',
      principalCents,
      installmentCount,
      firstDueOn,
      annualRateBps,
    });
    const sac = buildAmortizationSchedule({
      system: 'sac',
      principalCents,
      installmentCount,
      firstDueOn,
      annualRateBps,
    });
    return { price, sac };
  }, [showCompare, system, principal, count, rateAa, firstDueOn]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
      <div className="h-fit space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Calculator className="size-4 text-primary" />
            Parâmetros
          </p>
          <p className="text-xs text-muted-foreground">
            Simule e confirme o cronograma antes de gravar.
          </p>
        </div>
        <form
          id="financing-create-form"
          action={createFinancingAction}
          className="grid gap-4"
          onSubmit={(event) => {
            if (!simulation || !confirmed) {
              event.preventDefault();
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required placeholder="Carro / Casa" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="institution">Instituição</Label>
            <Input id="institution" name="institution" placeholder="Banco" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="amortizationSystem">Sistema</Label>
            <select
              id="amortizationSystem"
              name="amortizationSystem"
              className={nativeSelectClassName}
              value={system}
              onChange={(event) => {
                setSystem(event.target.value as AmortizationSystem);
                setConfirmed(false);
              }}
            >
              <option value="price">Price (parcelas iguais)</option>
              <option value="sac">SAC (parcelas decrescentes)</option>
              <option value="fixed">Parcela fixa do contrato</option>
            </select>
            <p className="text-xs text-muted-foreground">{SYSTEM_HELP[system]}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="principal">Principal (R$)</Label>
            <Input
              id="principal"
              name="principal"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={principal}
              onChange={(event) => {
                setPrincipal(event.target.value);
                setConfirmed(false);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="installmentCount">Qtd. parcelas</Label>
            <Input
              id="installmentCount"
              name="installmentCount"
              type="number"
              min="1"
              max="600"
              required
              value={count}
              onChange={(event) => {
                setCount(event.target.value);
                setConfirmed(false);
              }}
            />
          </div>
          {system === 'fixed' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="installmentAmount">Valor da parcela (R$)</Label>
              <Input
                id="installmentAmount"
                name="installmentAmount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={installmentAmount}
                onChange={(event) => {
                  setInstallmentAmount(event.target.value);
                  setConfirmed(false);
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="annualRate">Taxa a.a. (%)</Label>
              <Input
                id="annualRate"
                name="annualRate"
                type="number"
                step="0.01"
                min="0"
                required
                value={rateAa}
                onChange={(event) => {
                  setRateAa(event.target.value);
                  setConfirmed(false);
                }}
              />
              <input type="hidden" name="installmentAmount" value="" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="firstDueOn">1º vencimento</Label>
            <Input
              id="firstDueOn"
              name="firstDueOn"
              type="date"
              required
              value={firstDueOn}
              onChange={(event) => {
                setFirstDueOn(event.target.value);
                setConfirmed(false);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="costCenterId">Centro</Label>
            <select
              id="costCenterId"
              name="costCenterId"
              className={nativeSelectClassName}
              required
              defaultValue={defaultCostCenterId ?? centers[0]?.id}
            >
              {centers.map((center) => (
                <option key={center.id} value={center.id}>
                  {center.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="accountId">Conta</Label>
            <select id="accountId" name="accountId" className={nativeSelectClassName} required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>

          {system !== 'fixed' ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={showCompare}
                onChange={(event) => setShowCompare(event.target.checked)}
              />
              Comparar Price × SAC
            </label>
          ) : null}

          <label className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              disabled={!simulation}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <span>
              Confirmei o cronograma simulado. As parcelas gravadas serão exatamente estas.
            </span>
          </label>

          <Button type="submit" disabled={!simulation || !confirmed}>
            Gravar financiamento
          </Button>
        </form>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div className="border-b p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Simulação do cronograma</p>
              <p className="text-xs text-muted-foreground">
                {simulation
                  ? `${simulation.installmentCount} parcelas · este é o que será gerado`
                  : 'Preencha principal, parcelas, taxa e 1º vencimento'}
              </p>
            </div>
            {simulation ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="size-3.5" />
                {simulation.system.toUpperCase()}
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="space-y-4 p-0">
          {!simulation ? (
            <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
              <Calculator className="size-8 opacity-40" />
              <p>A simulação aparece aqui em tempo real.</p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">1ª parcela</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatBrlFromCents(simulation.firstInstallmentCents)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Última parcela</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatBrlFromCents(simulation.lastInstallmentCents)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Total pago</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatBrlFromCents(simulation.totalPaidCents)}
                  </p>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Juros totais</p>
                  <p className="text-lg font-semibold tabular-nums">
                    {formatBrlFromCents(simulation.totalInterestCents)}
                  </p>
                </div>
              </div>

              {compare ? (
                <div className="mx-4 grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Price
                    </p>
                    <p className="tabular-nums">
                      1ª {formatBrlFromCents(compare.price.firstInstallmentCents)}
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      juros {formatBrlFromCents(compare.price.totalInterestCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      SAC
                    </p>
                    <p className="tabular-nums">
                      1ª {formatBrlFromCents(compare.sac.firstInstallmentCents)} →{' '}
                      {formatBrlFromCents(compare.sac.lastInstallmentCents)}
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      juros {formatBrlFromCents(compare.sac.totalInterestCents)}
                    </p>
                  </div>
                </div>
              ) : null}

              <Separator />

              <ScrollArea className="h-[min(28rem,50vh)] px-2 pb-4">
                <ScheduleTable schedule={simulation.schedule} />
              </ScrollArea>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
