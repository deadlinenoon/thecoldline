export type InjuryItem = {
  name: string;
  status: string;
  position: string;
  note: string;
};

export type InjuryTeamReport = {
  list: InjuryItem[];
  count: number;
  sources: string[];
};

export type InjuryReport = {
  home: InjuryTeamReport;
  away: InjuryTeamReport;
  error?: string;
};
