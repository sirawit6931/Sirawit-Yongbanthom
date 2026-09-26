# Requirements Document

## Introduction

This feature extends the vocabulary learning module by adding a Spelling Mode as the third step in the VocabSet Wizard. Administrators can select vocabulary words from existing matching pairs to create spelling exercises where learners listen to words and type the correct spelling.

## Glossary

- **VocabSet_Wizard**: The administrative interface for creating vocabulary learning sets
- **VocabSet**: A collection of vocabulary words organized for learning exercises
- **Matching_Pairs**: Word pairs (English-Thai) created in Step 1 of the VocabSet Wizard
- **Spelling_Exercise**: A learning activity where users listen to a word and type its correct spelling
- **Firestore_Exercises**: Collection in Firebase Firestore storing exercise data
- **Spelling_Words**: Selected words from matching pairs used for spelling exercises
- **Admin_Interface**: The administrative dashboard for managing learning content
- **Learner_Interface**: The mobile application interface for users to complete exercises

## Requirements

### Requirement 1: Extend VocabSet Wizard to Three Steps

**User Story:** As an administrator, I want to create vocabulary sets with spelling exercises, so that learners can practice spelling words they've learned.

#### Acceptance Criteria

1. THE VocabSet_Wizard SHALL have three sequential steps: Matching, Fill-in-the-blank, and Spelling
2. WHEN an administrator navigates from Step 2, THE VocabSet_Wizard SHALL display Step 3
3. THE Stepper_Component SHALL display three steps with clear labels
4. WHEN Step 3 is active, THE Stepper_Component SHALL highlight the third step

### Requirement 2: Select Words for Spelling Exercises

**User Story:** As an administrator, I want to select specific words from matching pairs for spelling exercises, so that I can curate appropriate spelling practice.

#### Acceptance Criteria

1. WHEN Step 3 is displayed, THE Admin_Interface SHALL show a checkbox list of all words from Step 1 Matching_Pairs
2. FOR EACH word in Matching_Pairs, THE Admin_Interface SHALL display English and Thai translations
3. WHEN an administrator selects words, THE Selection_Counter SHALL update to show the count
4. IF no words are selected, THEN THE Save_Button SHALL be disabled
5. IF more than 15 words are selected, THEN THE Save_Button SHALL be disabled
6. THE Selection_Validation SHALL require at least 1 word and at most 15 words

### Requirement 3: Store Spelling Data in Firestore

**User Story:** As an administrator, I want spelling data saved properly in Firestore, so that learners can access spelling exercises.

#### Acceptance Criteria

1. WHEN a VocabSet is saved, THE Firestore_Database SHALL store spellingWords as an array field
2. EACH spellingWords item SHALL contain wordEN and wordTH properties
3. THE spellingWords array SHALL contain only selected words from Step 3
4. WHEN spellingWords is saved, THE Exercise_Generator SHALL create corresponding exercises in the exercises collection
5. EACH spelling exercise SHALL have type: 'vocab' and mode: 'spelling'

### Requirement 4: Create Spelling Exercises

**User Story:** As an administrator, I want spelling exercises automatically created, so that learners have proper spelling practice activities.

#### Acceptance Criteria

1. FOR EACH selected spelling word, THE Exercise_Generator SHALL create a Firestore_Exercise
2. EACH spelling exercise SHALL include the vocabSetId for reference
3. EACH spelling exercise SHALL include wordEN and wordTH for answer validation
4. EACH spelling exercise SHALL have a question prompt indicating spelling mode
5. EACH spelling exercise SHALL specify ttsVoice for text-to-speech functionality

### Requirement 5: Display Spelling Exercises to Learners

**User Story:** As a learner, I want to practice spelling vocabulary words, so that I can improve my spelling skills.

#### Acceptance Criteria

1. WHEN a learner accesses a VocabSet with spelling exercises, THE Learner_Interface SHALL display spelling mode exercises
2. FOR EACH spelling exercise, THE Learner_Interface SHALL provide a TTS button to hear the word
3. THE Learner_Interface SHALL provide a text input field for typing the answer
4. WHEN a learner submits an answer, THE Answer_Validator SHALL check spelling accuracy
5. IF the answer matches wordEN (case-insensitive), THEN THE Learner_Interface SHALL display correct feedback
6. IF the answer does not match wordEN, THEN THE Learner_Interface SHALL display incorrect feedback

### Requirement 6: Validate Spelling Answers

**User Story:** As a learner, I want immediate feedback on my spelling attempts, so that I can learn from my mistakes.

#### Acceptance Criteria

1. THE Answer_Validator SHALL compare user input to wordEN with case-insensitive matching
2. THE Answer_Validator SHALL trim whitespace from user input before comparison
3. WHEN validation is complete, THE Learner_Interface SHALL display appropriate feedback
4. THE Feedback_System SHALL show "✓ ถูกต้อง!" for correct answers
5. THE Feedback_System SHALL show "✗ ไม่ถูกต้อง ลองใหม่" for incorrect answers
6. AFTER validation, THE Learner_Interface SHALL enable navigation to the next exercise

### Requirement 7: Maintain Data Consistency

**User Story:** As an administrator, I want consistent data across all steps, so that vocabulary sets are properly structured.

#### Acceptance Criteria

1. THE VocabSet_Document SHALL maintain all fields from previous steps when adding spellingWords
2. WHEN spellingWords are saved, THE VocabSet_Document SHALL preserve matchingPairs and fillInBlanks data
3. THE Status_Field SHALL reflect draft or published state based on administrator selection
4. ALL VocabSet fields SHALL be validated before saving to Firestore

### Requirement 8: Provide User Guidance

**User Story:** As an administrator, I want clear guidance when creating spelling exercises, so that I understand the process.

#### Acceptance Criteria

1. WHEN Step 3 is displayed, THE Admin_Interface SHALL show instructional text about spelling exercise creation
2. THE Instructional_Text SHALL explain that words are selected from Step 1 matching pairs
3. THE Instructional_Text SHALL indicate maximum word limit (10-15 words)
4. THE Selection_Counter SHALL be prominently displayed to show selected count
5. ERROR messages SHALL be clear and actionable when validation fails

### Requirement 9: Support Existing Functionality

**User Story:** As an administrator, I want spelling mode to integrate seamlessly with existing features, so that the system remains stable.

#### Acceptance Criteria

1. THE Spelling_Mode SHALL not interfere with existing Matching and Fill-in-the-blank functionality
2. EXISTING VocabSet documents SHALL remain compatible after schema update
3. THE Admin_Interface SHALL maintain all existing navigation and validation
4. THE Save_Process SHALL handle all three steps without data loss
5. EXISTING learner exercises SHALL continue to function normally