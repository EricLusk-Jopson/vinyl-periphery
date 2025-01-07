import styled from "styled-components";

export const ResultsContainer = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const Section = styled.section`
  background: ${({ theme }) => theme.colors.background.secondary};
  padding: ${({ theme }) => theme.spacing.lg};
`;

export const SectionTitle = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }) => theme.colors.text.primary};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.normal};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

export const Grid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const FilterToggle = styled.button<{ $isActive: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  background: ${({ theme, $isActive }) =>
    $isActive ? theme.colors.primary.main : theme.colors.background.primary};
  color: ${({ theme }) => theme.colors.text.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary.main};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  cursor: pointer;
  opacity: ${({ disabled }) => (disabled ? 0.5 : 1)};
  transition: all 0.2s ease-in-out;
  white-space: nowrap;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primary.dark};
  }

  &:disabled {
    cursor: not-allowed;
  }
`;

export const ReleaseCard = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.primary.main};
`;

export const ReleaseTitle = styled.h3`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  color: ${({ theme }) => theme.colors.text.primary};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.normal};
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

export const ReleaseInfo = styled.p`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};

  &:not(:last-child) {
    margin-bottom: ${({ theme }) => theme.spacing.sm};
  }
`;

export const ContributorList = styled(ReleaseInfo)`
  margin-top: ${({ theme }) => theme.spacing.md};
`;
