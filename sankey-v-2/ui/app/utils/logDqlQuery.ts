type DqlTimeframe = {
  defaultTimeframeStart?: string;
  defaultTimeframeEnd?: string;
};

export const logDqlQuery = (query: string, timeframe?: DqlTimeframe) => {
  const timeframeLabel =
    timeframe?.defaultTimeframeStart && timeframe.defaultTimeframeEnd
      ? `\nDefault timeframe: ${timeframe.defaultTimeframeStart} to ${timeframe.defaultTimeframeEnd}`
      : "";

  console.info(`[DQL] Executing query:\n${query}${timeframeLabel}`);
};
