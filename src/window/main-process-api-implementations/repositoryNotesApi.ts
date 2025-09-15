import { ipcRenderer } from 'electron';
import { RepositoryNotesAPIEvent } from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import type { 
  StoreNoteRequest, 
  RepositoryNotesAPI
} from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';
import { RepositoryNote } from '../../shared/main-process-api-interfaces/RepositoryNotesAPI';

export const repositoryNotesApi: RepositoryNotesAPI = {
  getNotesForRepository: (remoteUrl: string) => 
      ipcRenderer.invoke(
        RepositoryNotesAPIEvent.GET_FOR_REPOSITORY,
        remoteUrl
      ),

  getNotesForPath: (path: string, includeParentNotes: boolean = true) => 
      ipcRenderer.invoke(
        RepositoryNotesAPIEvent.GET_FOR_PATH,
        path,
        includeParentNotes
      ),

  storeNote: (request: StoreNoteRequest) => 
      ipcRenderer.invoke(
        RepositoryNotesAPIEvent.STORE_NOTE,
        request
      ),

  deleteNote: (remoteUrl: string, noteId: string) => 
      ipcRenderer.invoke(
        RepositoryNotesAPIEvent.DELETE_NOTE,
        remoteUrl,
        noteId
      ),

  updateNote: (
    remoteUrl: string,
    noteId: string,
    updates: Partial<Pick<RepositoryNote, 'note' | 'metadata'>>
  ) => 
      ipcRenderer.invoke(
        RepositoryNotesAPIEvent.UPDATE_NOTE,
        remoteUrl,
        noteId,
        updates
      )
}
