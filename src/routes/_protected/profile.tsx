import { Link, createFileRoute } from '@tanstack/react-router'
import {
  Anchor,
  Avatar,
  Badge,
  Box,
  Card,
  Container,
  Group,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { BottomNav, HomeTopBar, createHomeDashboardData } from '~/components/home'
import { currentUserQuery } from '~/lib/auth-queries'

export const Route = createFileRoute('/_protected/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  const theme = useMantineTheme()
  const { data: currentUser } = useSuspenseQuery(currentUserQuery)
  const homeDashboardData = useMemo(
    () => createHomeDashboardData(currentUser.displayName),
    [currentUser.displayName],
  )
  const roleLabels =
    currentUser.roles.length > 0
      ? currentUser.roles.map(getRoleLabel)
      : ['طالب']
  const profileFields = [
    {
      label: 'الاسم الكامل',
      value: currentUser.displayName,
    },
    {
      label: 'اسم المستخدم',
      value: currentUser.username ? `@${currentUser.username}` : 'غير مضاف بعد',
    },
    {
      label: 'البريد الإلكتروني',
      value: currentUser.email ?? 'غير متوفر',
    },
    {
      label: 'حالة الحساب',
      value: currentUser.status === 'active' ? 'نشط' : 'موقوف',
    },
  ]

  return (
    <Box
      style={{
        backgroundColor: theme.other.semanticColors.background,
        minHeight: '100vh',
      }}
    >
      <HomeTopBar
        brandMarkText={homeDashboardData.brandMarkText}
        brandName={homeDashboardData.brandName}
        notificationLabel={homeDashboardData.notificationLabel}
      />

      <Container
        size="xl"
        px={{ base: 'lg', sm: 'xl' }}
        py={{ base: 'lg', sm: 'xl' }}
        style={{ paddingBottom: '9rem' }}
      >
        <Stack gap="xl">
          <Stack gap="xs">
            <Text c="primary.6" fw={700} size="sm">
              الملف الشخصي
            </Text>
            <Title order={1}>بيانات الحساب</Title>
            <Text c="dimmed">
              هنا تجد المعلومات الأساسية المرتبطة بحسابك داخل التطبيق.
            </Text>
          </Stack>

          <Paper
            withBorder
            radius="xl"
            p={{ base: 'lg', sm: 'xl' }}
            shadow="sm"
          >
            <Stack gap="xl">
              <Group align="flex-start" wrap="nowrap">
                <Avatar color="primary" radius="xl" size={72}>
                  {getInitials(currentUser.displayName)}
                </Avatar>

                <Stack gap={6} style={{ minWidth: 0, flex: 1 }}>
                  <Group gap="sm" wrap="wrap">
                    <Title order={2} lineClamp={2} style={{ wordBreak: 'break-word' }}>
                      {currentUser.displayName || 'بدون اسم'}
                    </Title>
                    <Badge
                      color={currentUser.status === 'active' ? 'teal' : 'red'}
                      radius="xl"
                      variant="light"
                    >
                      {currentUser.status === 'active' ? 'نشط' : 'موقوف'}
                    </Badge>
                  </Group>

                  <Text c="dimmed">
                    {currentUser.username ? `@${currentUser.username}` : 'بدون اسم مستخدم'}
                  </Text>

                  <Group gap="xs">
                    {roleLabels.map((role) => (
                      <Badge
                        key={role}
                        color="primary"
                        radius="xl"
                        variant="dot"
                      >
                        {role}
                      </Badge>
                    ))}
                  </Group>
                </Stack>
              </Group>

              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                {profileFields.map((field) => (
                  <Card key={field.label} withBorder radius="lg" p="md">
                    <Stack gap={4}>
                      <Text c="dimmed" fw={600} size="sm">
                        {field.label}
                      </Text>
                      <Text fw={700}>{field.value}</Text>
                    </Stack>
                  </Card>
                ))}
              </SimpleGrid>

              {(currentUser.isAdmin || currentUser.isTeacher) ? (
                <Anchor component={Link} to="/staff/students" fw={700}>
                  إدارة الطلاب
                </Anchor>
              ) : null}
            </Stack>
          </Paper>
        </Stack>
      </Container>

      <BottomNav activeItemId="profile" items={homeDashboardData.bottomNavItems} />
    </Box>
  )
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
  return initials || '؟'
}

function getRoleLabel(role: string) {
  if (role === 'admin') {
    return 'مشرف'
  }

  return role
}
