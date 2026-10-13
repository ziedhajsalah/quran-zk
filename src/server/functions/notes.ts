import { createServerFn } from '@tanstack/react-start'
import { withRuntime } from '../runtime.server'
import * as service from '../services/notes.server'
import { bodySchema, noteIdInput, studentInput } from './validation'

export const listForStudent = createServerFn({ method: 'GET' })
  .inputValidator(studentInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) =>
      service.listNotes(db, actor, data.studentId),
    ),
  )
export const add = createServerFn({ method: 'POST' })
  .inputValidator(studentInput.extend({ body: bodySchema }))
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.addNote(db, actor, data)),
  )
export const edit = createServerFn({ method: 'POST' })
  .inputValidator(noteIdInput.extend({ body: bodySchema }))
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.editNote(db, actor, data)),
  )
export const remove = createServerFn({ method: 'POST' })
  .inputValidator(noteIdInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.removeNote(db, actor, data)),
  )
