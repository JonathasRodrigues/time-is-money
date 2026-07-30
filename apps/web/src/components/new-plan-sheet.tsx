'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  formatBrlFromCents,
  parseBrlToCents,
  PLAN_KIND_LABEL,
  sumPlanItems,
  TRAVEL_ITEM_TEMPLATES,
  type PlanKind,
} from '@tim/domain';
import { Plus, Trash2 } from 'lucide-react';
import { LinkAccountSelect } from '@/components/link-account-select';
import { PlanGoalSimulator } from '@/components/plan-goal-simulator';
import { PlanPayoffSimulator } from '@/components/plan-payoff-simulator';
import { PlanScheduleGenerator } from '@/components/plan-schedule-generator';
import { nativeSelectClassName } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { SubmitButton } from '@/components/ui/submit-button';
import { useMutationFeedback } from '@/hooks/use-mutation-feedback';
import { createPlanAction } from '@/lib/api/mutations';
import type { AmortizationSystem, FinancingCategory, PlanContributionRow } from '@tim/domain';

type CreationMode = 'detailed' | 'generator';

function isFinancingLinkedKind(kind: PlanKind): boolean {
  return kind === 'financing_payoff' || kind === 'real_estate_amortization';
}

interface Option {
  id: string;
  name: string;
}

interface FinancingOption {
  id: string;
  name: string;
  category: FinancingCategory;
  balanceCents: number;
  system: AmortizationSystem;
  annualRateBps: number | null;
  installmentAmountCents: number;
  amortizationCents: number;
  firstDueOn: string;
  pendingInstallments: Array<{
    number: number;
    dueOn: string;
    principalCents: number;
    amountCents: number;
    interestCents: number;
  }>;
}

interface DraftItem {
  label: string;
  amount: string;
}

export function NewPlanSheet({
  centers,
  potAccounts,
  financings,
  defaultCostCenterId,
  presetFinancingId,
  presetKind,
  trigger,
}: {
  centers: Option[];
  potAccounts: Option[];
  financings: FinancingOption[];
  defaultCostCenterId?: string;
  presetFinancingId?: string;
  presetKind?: PlanKind;
  trigger?: React.ReactNode;
}): React.ReactElement {
  const initialKind: PlanKind = presetKind ?? (presetFinancingId ? 'financing_payoff' : 'travel');
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { run } = useMutationFeedback();
  const [creationMode, setCreationMode] = useState<CreationMode>(
    isFinancingLinkedKind(initialKind) ? 'detailed' : 'generator',
  );
  const [kind, setKind] = useState<PlanKind>(initialKind);
  const [name, setName] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [financingId, setFinancingId] = useState(presetFinancingId ?? '');
  const [items, setItems] = useState<DraftItem[]>(
    TRAVEL_ITEM_TEMPLATES.slice(0, 2).map((template) => ({
      label: template.label,
      amount: template.label === 'Hospedagem' ? '5000' : '3000',
    })),
  );
  const [linkedAccountId, setLinkedAccountId] = useState('');
  const [createLinkedAccount, setCreateLinkedAccount] = useState(potAccounts.length === 0);
  const [linkedAccountName, setLinkedAccountName] = useState('');
  const [linkedAccountCostCenterId, setLinkedAccountCostCenterId] = useState(
    defaultCostCenterId ?? centers[0]?.id ?? '',
  );
  const [genMonthCount, setGenMonthCount] = useState('10');
  const [genMonthlyAmount, setGenMonthlyAmount] = useState('800');
  const [genGoalAmount, setGenGoalAmount] = useState('10000');
  const [contributions, setContributions] = useState<PlanContributionRow[]>([]);

  const financingChoices = useMemo(() => {
    if (kind === 'real_estate_amortization') {
      return financings.filter((financing) => financing.category === 'real_estate');
    }
    return financings;
  }, [financings, kind]);

  const selectedFinancing = financingChoices.find((f) => f.id === financingId) ?? null;
  const monthlyTargetCents = parseBrlToCents(genMonthlyAmount);

  const parsedItems = useMemo(() => {
    return items
      .map((item, index) => {
        const amountCents = parseBrlToCents(item.amount);
        if (!item.label.trim() || amountCents == null || amountCents <= 0) return null;
        return {
          label: item.label.trim(),
          amountCents,
          sortOrder: index,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item != null);
  }, [items]);

  const targetCents =
    creationMode === 'generator' && !isFinancingLinkedKind(kind)
      ? (parseBrlToCents(genGoalAmount) ?? 0)
      : sumPlanItems(parsedItems);

  const submitItems = useMemo(() => {
    if (creationMode === 'generator' && !isFinancingLinkedKind(kind)) {
      const cents = parseBrlToCents(genGoalAmount);
      if (cents == null || cents <= 0 || !name.trim()) return [];
      return [{ label: name.trim(), amountCents: cents, sortOrder: 0 }];
    }
    return parsedItems;
  }, [creationMode, kind, genGoalAmount, name, parsedItems]);

  function resetForKind(nextKind: PlanKind): void {
    setKind(nextKind);
    setCreationMode(isFinancingLinkedKind(nextKind) ? 'detailed' : 'generator');
    if (nextKind === 'financing_payoff') {
      const financing = financings[0];
      setFinancingId(presetFinancingId ?? financing?.id ?? '');
      setName(financing ? `Quitar ${financing.name}` : 'Quitação de financiamento');
      setItems([
        {
          label: 'Reserva para quitação',
          amount: financing ? String(Math.round(financing.balanceCents / 100)) : '1000',
        },
      ]);
    } else if (nextKind === 'real_estate_amortization') {
      const realEstate = financings.filter((financing) => financing.category === 'real_estate');
      const financing =
        realEstate.find((item) => item.id === presetFinancingId) ?? realEstate[0] ?? null;
      setFinancingId(financing?.id ?? '');
      setName(financing ? `Amortizar ${financing.name}` : 'Amortização imobiliária');
      setItems([
        {
          label: 'Reserva para amortização',
          amount: financing ? String(Math.round(financing.balanceCents / 100)) : '1000',
        },
      ]);
    } else if (nextKind === 'travel') {
      setFinancingId('');
      setName('Viagem');
      setItems(
        TRAVEL_ITEM_TEMPLATES.map((template) => ({
          label: template.label,
          amount: '',
        })),
      );
    } else {
      setFinancingId('');
      setName('');
      setItems([{ label: 'Item 1', amount: '1000' }]);
    }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    if (submitItems.length === 0 || !name.trim() || !targetDate) return;
    if (isFinancingLinkedKind(kind) && !financingId) return;

    startTransition(async () => {
      try {
        await run(
          () =>
            createPlanAction({
              kind,
              name: name.trim(),
              targetDate,
              financingId: isFinancingLinkedKind(kind) ? financingId : null,
              linkedAccountId: createLinkedAccount ? null : linkedAccountId || null,
              monthlyTargetCents:
                creationMode === 'generator' && monthlyTargetCents != null
                  ? monthlyTargetCents
                  : null,
              createLinkedAccount,
              linkedAccountName: linkedAccountName.trim() || undefined,
              linkedAccountCostCenterId: createLinkedAccount
                ? linkedAccountCostCenterId
                : undefined,
              items: submitItems,
              contributions:
                creationMode === 'generator' && contributions.length > 0
                  ? contributions.map((row, index) => ({
                      dueOn: row.dueOn,
                      amountCents: row.amountCents,
                      sortOrder: index,
                    }))
                  : undefined,
            }),
          { loading: 'Criando plano…', success: 'Plano criado', invalidate: 'financing' },
        );
        setOpen(false);
      } catch {
        // toast
      }
    });
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next && presetFinancingId) {
          resetForKind(presetKind ?? 'financing_payoff');
          setFinancingId(presetFinancingId);
        }
      }}
    >
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Novo plano
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>Novo plano</SheetTitle>
          <SheetDescription>
            Defina meta, itens e vincule uma caixinha para acompanhar o progresso.
          </SheetDescription>
        </SheetHeader>

        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="planKind">Tipo</Label>
            <select
              id="planKind"
              className={nativeSelectClassName}
              value={kind}
              onChange={(event) => resetForKind(event.target.value as PlanKind)}
            >
              {(Object.keys(PLAN_KIND_LABEL) as PlanKind[]).map((key) => (
                <option key={key} value={key}>
                  {PLAN_KIND_LABEL[key]}
                </option>
              ))}
            </select>
          </div>

          {kind !== 'financing_payoff' && kind !== 'real_estate_amortization' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="creationMode">Como montar o plano</Label>
              <select
                id="creationMode"
                className={nativeSelectClassName}
                value={creationMode}
                onChange={(event) => setCreationMode(event.target.value as CreationMode)}
              >
                <option value="generator">Gerar cronograma (meta + aporte mensal)</option>
                <option value="detailed">Detalhado (itens avulsos)</option>
              </select>
            </div>
          ) : null}

          {creationMode === 'generator' && !isFinancingLinkedKind(kind) ? (
            <PlanScheduleGenerator
              goalName={name}
              goalAmount={genGoalAmount}
              monthCount={genMonthCount}
              monthlyAmount={genMonthlyAmount}
              contributions={contributions}
              onGoalNameChange={setName}
              onGoalAmountChange={setGenGoalAmount}
              onMonthCountChange={setGenMonthCount}
              onMonthlyAmountChange={setGenMonthlyAmount}
              onContributionsChange={setContributions}
              onTargetDateChange={setTargetDate}
            />
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="planName">Nome</Label>
                <Input
                  id="planName"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  placeholder="Viagem ao Japão 2027"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="planTargetDate">Data alvo</Label>
                <DateInput
                  id="planTargetDate"
                  value={targetDate}
                  onValueChange={setTargetDate}
                  required
                />
              </div>

              {kind === 'financing_payoff' || kind === 'real_estate_amortization' ? (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="planFinancingId">
                    {kind === 'real_estate_amortization'
                      ? 'Financiamento imobiliário'
                      : 'Financiamento'}
                  </Label>
                  <select
                    id="planFinancingId"
                    className={nativeSelectClassName}
                    value={financingId}
                    onChange={(event) => {
                      const id = event.target.value;
                      setFinancingId(id);
                      const financing = financingChoices.find((f) => f.id === id);
                      if (financing) {
                        const isAmort = kind === 'real_estate_amortization';
                        setName(`${isAmort ? 'Amortizar' : 'Quitar'} ${financing.name}`);
                        setItems([
                          {
                            label: isAmort ? 'Reserva para amortização' : 'Reserva para quitação',
                            amount: String(Math.round(financing.balanceCents / 100)),
                          },
                        ]);
                      }
                    }}
                    required
                  >
                    <option value="">Selecione…</option>
                    {financingChoices.map((financing) => (
                      <option key={financing.id} value={financing.id}>
                        {financing.name} · {formatBrlFromCents(financing.balanceCents)} restante
                      </option>
                    ))}
                  </select>
                  {kind === 'real_estate_amortization' && financingChoices.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhum financiamento imobiliário com saldo disponível. Cadastre um em
                      Financiamentos (categoria Imóvel).
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Itens do plano</Label>
                    <p className="text-xs text-muted-foreground">
                      A soma vira a meta do simulador de reserva.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {kind === 'travel' ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setItems(
                            TRAVEL_ITEM_TEMPLATES.map((template) => ({
                              label: template.label,
                              amount: '',
                            })),
                          )
                        }
                      >
                        Templates viagem
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setItems((prev) => [...prev, { label: '', amount: '' }])}
                    >
                      Adicionar
                    </Button>
                  </div>
                </div>
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-[1fr_8rem_auto] gap-2">
                    <Input
                      value={item.label}
                      onChange={(event) =>
                        setItems((prev) =>
                          prev.map((row, i) =>
                            i === index ? { ...row, label: event.target.value } : row,
                          ),
                        )
                      }
                      placeholder="Descrição"
                    />
                    <MoneyInput
                      value={item.amount}
                      onValueChange={(value) =>
                        setItems((prev) =>
                          prev.map((row, i) => (i === index ? { ...row, amount: value } : row)),
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      disabled={items.length <= 1}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
                <p className="text-sm font-medium tabular-nums">
                  Total da meta: {formatBrlFromCents(targetCents)}
                </p>
              </div>
            </>
          )}

          {creationMode === 'generator' && targetDate ? (
            <p className="text-sm text-muted-foreground">
              Data alvo: <span className="font-medium text-foreground">{targetDate}</span>
            </p>
          ) : null}

          {isFinancingLinkedKind(kind) && selectedFinancing && targetDate ? (
            <PlanPayoffSimulator
              balanceCents={selectedFinancing.balanceCents}
              system={selectedFinancing.system}
              annualRateBps={selectedFinancing.annualRateBps}
              installmentAmountCents={selectedFinancing.installmentAmountCents}
              amortizationCents={selectedFinancing.amortizationCents}
              firstDueOn={selectedFinancing.firstDueOn}
              pendingInstallments={selectedFinancing.pendingInstallments}
              targetDate={targetDate}
              variant={kind === 'real_estate_amortization' ? 'amortization' : 'payoff'}
              onSuggestedReserveCents={(cents) => {
                const label =
                  kind === 'real_estate_amortization'
                    ? 'Reserva para amortização'
                    : 'Reserva para quitação';
                setItems([
                  {
                    label,
                    amount: String(Math.max(1, Math.round(cents / 100))),
                  },
                ]);
                setGenMonthlyAmount((Math.round(cents / 12) / 100).toFixed(2).replace('.', ','));
              }}
            />
          ) : null}

          {!isFinancingLinkedKind(kind) && targetCents > 0 && targetDate ? (
            <PlanGoalSimulator
              targetCents={targetCents}
              savedCents={0}
              targetDate={targetDate}
              defaultMonthlyCents={monthlyTargetCents}
              items={
                creationMode === 'generator'
                  ? [{ label: name.trim() || 'Meta', amountCents: targetCents }]
                  : parsedItems.map((item) => ({
                      label: item.label,
                      amountCents: item.amountCents,
                    }))
              }
            />
          ) : null}

          <LinkAccountSelect
            accounts={potAccounts}
            centers={centers}
            value={linkedAccountId}
            onValueChange={setLinkedAccountId}
            createNew={createLinkedAccount}
            onCreateNewChange={setCreateLinkedAccount}
            newAccountName={linkedAccountName}
            onNewAccountNameChange={setLinkedAccountName}
            newAccountCostCenterId={linkedAccountCostCenterId}
            onNewAccountCostCenterIdChange={setLinkedAccountCostCenterId}
          />

          <SubmitButton
            isPending={pending}
            disabled={
              submitItems.length === 0 ||
              (isFinancingLinkedKind(kind) && !financingId) ||
              (creationMode === 'generator' &&
                !isFinancingLinkedKind(kind) &&
                contributions.length === 0)
            }
          >
            Criar plano
          </SubmitButton>
        </form>
      </SheetContent>
    </Sheet>
  );
}
