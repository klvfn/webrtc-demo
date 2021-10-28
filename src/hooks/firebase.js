import firebase from '../utils/firebase'
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  query,
  onSnapshot,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc
} from 'firebase/firestore'
import { useCallback, useRef, useReducer, useEffect } from 'react'

export const useRealtimeSnapshotCollection = (collectionID, onlyChanges) => {
  const firestoreRef = useRef(getFirestore(firebase))
  const colRef = useRef(collection(firestoreRef.current, collectionID))
  const [state, setState] = useReducer(
    (prevState, newState) => ({
      ...prevState,
      ...newState
    }),
    {
      data: null,
      isError: false,
      isLoading: true
    }
  )

  useEffect(() => {
    const snapshotQuery = query(colRef.current)
    const unsubscribe = onSnapshot(
      snapshotQuery,
      (snapshot) => {
        setState({
          isLoading: true
        })
        const data = []
        if (onlyChanges) {
          snapshot.docChanges().forEach((change) => {
            data.push({ id: change.doc.id, ...change.doc.data() })
          })
        } else {
          snapshot.forEach((s) => {
            data.push({ id: s.id, ...s.data() })
          })
        }
        setState({
          isLoading: false,
          data,
          isError: false
        })
      },
      (error) => {
        console.log(`[GET SNAPSHOT FAILED] Error: ${error}`)
        setState({
          isLoading: false,
          data: null,
          isError: true
        })
      }
    )
    return unsubscribe
  }, [onlyChanges])

  return state
}

export const useCollection = () => {
  const firestoreRef = useRef(getFirestore(firebase))
  const [state, setState] = useReducer(
    (prevState, newState) => ({
      ...prevState,
      ...newState
    }),
    {
      data: null,
      isError: false,
      isLoading: false
    }
  )
  const createDoc = useCallback(async (collectionID, data) => {
    try {
      setState({
        isLoading: true
      })
      const colRef = collection(firestoreRef.current, collectionID)
      const result = await addDoc(colRef, data)
      setState({
        isLoading: false
      })
      return result.id
    } catch (error) {
      setState({
        isLoading: false,
        isError: true
      })
      console.log(`[CREATE DOCUMENT FAILED] Error: ${error}`)
    }
  }, [])

  const get = useCallback(async (collectionID) => {
    try {
      setState({
        isLoading: true
      })
      const q = query(collection(firestoreRef.current, collectionID))
      const snapshot = await getDocs(q)
      const data = []
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }))
      setState({
        isLoading: false
      })
      return data
    } catch (error) {
      setState({
        isLoading: false,
        isError: true
      })
      console.log(`[CREATE DOCUMENT FAILED] Error: ${error}`)
    }
  }, [])

  return {
    createDoc,
    get,
    ...state
  }
}

export const useDocument = () => {
  const firestoreRef = useRef(getFirestore(firebase))
  const [state, setState] = useReducer(
    (prevState, newState) => ({
      ...prevState,
      ...newState
    }),
    {
      data: null,
      isError: false,
      isLoading: false
    }
  )
  const get = useCallback(async (documentID) => {
    try {
      setState({
        isLoading: true
      })
      const snapshot = await getDoc(doc(firestoreRef.current, documentID))
      setState({
        isLoading: false,
        data: snapshot.exists()
          ? {
              id: snapshot.id,
              ...snapshot.data()
            }
          : null,
        isError: false
      })
    } catch (error) {
      setState({
        isLoading: false,
        isError: true
      })
      console.log(`[GET SINGLE DOCUMENT FAILED] Error: ${error}`)
    }
  }, [])

  const upsert = useCallback(async (documentID, data) => {
    try {
      setState({
        isLoading: true
      })
      await setDoc(doc(firestoreRef.current, documentID), data, { merge: true })
      setState({
        isLoading: false
      })
    } catch (error) {
      setState({
        isLoading: false,
        isError: true
      })
      console.log(`[GET SINGLE DOCUMENT FAILED] Error: ${error}`)
    }
  }, [])

  const remove = useCallback(async (documentID) => {
    try {
      setState({
        isLoading: true
      })
      await deleteDoc(doc(firestoreRef.current, documentID))
      setState({
        isLoading: false
      })
    } catch (error) {
      setState({
        isLoading: false,
        isError: true
      })
      console.log(`[DELETE DOCUMENT FAILED] Error: ${error}`)
    }
  }, [])

  return {
    get,
    upsert,
    remove,
    ...state
  }
}
