# Technical Requirements: MySongs Component Update Issue

## Problem Statement
**Reference**: `game_setup_todo.md` - Point 1
> "Players do not see their added songs. After adding song, MySongs.tsx is not updated/populated."

## Root Cause Analysis

After analyzing the codebase, the issue stems from a **data flow mismatch** between the song addition process and the MySongs component subscription pattern:

### Current Implementation Issues:

1. **Data Flow Inconsistency**:
   - `SearchDialog.tsx` uses `addTrackToPlaylist()` to add songs directly to the playlist collection
   - `MySongs.tsx` subscribes to track proposals via `subscribeTrackProposals()` 
   - These are **two separate data stores** that don't sync

2. **Code Location Evidence**:
   ```typescript
   // SearchDialog.tsx line 91-92 (handleAddTrack function)
   await addTrackToPlaylist(lobbyId, track.uri, currentUserId, track);
   // await addTrackProposal(lobbyId, currentUserId, track); // COMMENTED OUT!
   ```

   ```typescript
   // MySongs.tsx line 17-21 (useEffect subscription)
   const unsubscribe = subscribeTrackProposals(lobbyId, userId, (userProposals) => {
     const myProposals = userProposals.filter(p => p.proposedBy === userId);
     setProposals(myProposals);
   });
   ```

3. **Firebase Data Structure**:
   - Track proposals: `lobbies/{lobbyId}/proposals/{encodedTrackUri}`
   - Playlist collection: `playlists/{lobbyId}`
   - MySongs subscribes to proposals but SearchDialog writes to playlist collection

## Technical Requirements

### Requirement 1: Fix Data Flow Consistency
**Priority**: Critical
**Effort**: Low

**Option A (Recommended)**: Restore dual-write pattern
- Uncomment the `addTrackProposal()` call in SearchDialog
- Ensure both playlist collection and proposals are updated
- Maintain existing MySongs subscription to proposals

**Implementation**:
```typescript
// In SearchDialog.tsx handleAddTrack function
await addTrackToPlaylist(lobbyId, track.uri, currentUserId, track);
await addTrackProposal(lobbyId, currentUserId, track); // RESTORE THIS LINE
```

**Option B**: Change MySongs to subscribe to playlist collection
- Modify MySongs to use `subscribePlaylistCollection()` instead
- Filter playlist data by current user
- Update component props and state management

### Requirement 2: Add Error Handling & Synchronization
**Priority**: High
**Effort**: Medium

- Add rollback mechanism if either write operation fails
- Implement retry logic for failed writes
- Add loading states during song addition
- Ensure atomic updates where possible

### Requirement 3: Update Status Propagation
**Priority**: Medium
**Effort**: Low

- Ensure proposal status updates are reflected in MySongs
- Add real-time status indicators (pending, approved, rejected)
- Sync approval status between proposals and playlist collection

### Requirement 4: Data Validation & Deduplication
**Priority**: Medium  
**Effort**: Low

- Prevent duplicate song additions within proposals
- Validate track data consistency between stores
- Add conflict resolution for edge cases

## Implementation Strategy

### Phase 1: Quick Fix (Immediate)
1. Restore the commented `addTrackProposal()` call in SearchDialog
2. Test MySongs component updates after song addition
3. Verify no data inconsistencies

### Phase 2: Robust Solution (Short-term)
1. Add error handling and transaction-like behavior
2. Implement proper loading states
3. Add validation and deduplication logic
4. Update unit tests

### Phase 3: Optimization (Long-term)
1. Consider consolidating to single data store
2. Implement proper caching layer
3. Add offline support
4. Performance optimization

## Files to Modify

1. **Primary**:
   - `/workspace/src/components/SearchDialog/SearchDialog.tsx` (Line 92)
   
2. **Secondary** (if choosing Option B):
   - `/workspace/src/components/MySongs/MySongs.tsx` (Lines 17-21)
   - `/workspace/src/services/firebase.ts` (Subscription functions)

3. **Testing**:
   - Add/update tests for both components
   - Integration tests for song addition flow

## Success Criteria

- [ ] Players see added songs immediately in MySongs component
- [ ] No data inconsistencies between proposals and playlist collection  
- [ ] Proper error handling for failed song additions
- [ ] Real-time status updates for song approval/rejection
- [ ] No duplicate songs in user's list
- [ ] Component updates work for both host and non-host players

## Risk Assessment

**Low Risk**: Option A (restore dual-write) - minimal code change, maintains existing architecture
**Medium Risk**: Option B (change subscription) - requires more testing, potential breaking changes
**Dependencies**: None - isolated fix within frontend components