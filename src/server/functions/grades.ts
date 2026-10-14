import { createServerFn } from '@tanstack/react-start'
import { withRuntime } from '../runtime.server'
import * as service from '../services/grades.server'
import { gradeSchema, studentInput, surahInput } from './validation'

export const listAllStudents = createServerFn({ method: 'GET' }).handler(() =>
  withRuntime(({ db, actor }) => service.listStudents(db, actor)),
)
export const listForStudent = createServerFn({ method: 'GET' })
  .validator(studentInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) =>
      service.listGrades(db, actor, data.studentId),
    ),
  )
export const setGrade = createServerFn({ method: 'POST' })
  .validator(surahInput.extend({ grade: gradeSchema }))
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.setGrade(db, actor, data)),
  )
export const removeFromList = createServerFn({ method: 'POST' })
  .validator(surahInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.removeGrade(db, actor, data)),
  )
