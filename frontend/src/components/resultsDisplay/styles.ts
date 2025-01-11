import styled from "styled-components";

export const ResultsContainer = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.lg};
  margin: 0 auto;
  width: 100%;
  max-width: ${({ theme }) => theme.breakpoints.xl};
`;

export const SectionTitle = styled.h2`
  font-family: ${({ theme }) => theme.typography.fontFamily.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }) => theme.colors.text.primary};
  letter-spacing: ${({ theme }) => theme.typography.letterSpacing.normal};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing.md};
  gap: ${({ theme }) => theme.spacing.md};
`;

export const ReleaseCard = styled.div`
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.primary.main};
  max-width: 80%;
  width: 700px;
  margin: 0 auto;
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

export const Grid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  height: auto; // Allow grid to grow as needed
`;

export const FilterToggle = styled.button<{ $isActive: boolean }>`
  display: inline-flex;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.xs};
  background: ${({ theme, $isActive }) =>
    $isActive ? theme.colors.primary.main : theme.colors.background.primary};
  color: ${({ theme }) => theme.colors.text.primary};
  border: 1px solid ${({ theme }) => theme.colors.primary.main};
  font-family: ${({ theme }) => theme.typography.fontFamily.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  cursor: pointer;
  white-space: nowrap;
  max-width: calc(100%); // Leave room for gap
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.2s ease-in-out;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primary.dark};
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: ${({ theme }) => theme.colors.background.primary};
    border-color: ${({ theme }) => theme.colors.text.disabled};
    &:hover {
      background: ${({ theme }) => theme.colors.background.primary};
    }
  }
`;

// Update Section to have proper padding and prevent overflow
export const Section = styled.section<{ $fullWidth?: boolean }>`
  background: ${({ theme }) => theme.colors.background.secondary};
  padding: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  overflow-x: hidden;
`;

// Update FiltersContainer to handle overflow properly
export const FiltersContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  overflow-x: hidden;
  padding-right: ${({ theme }) =>
    theme.spacing.sm}; // Add some padding to account for scrollbar
`;
